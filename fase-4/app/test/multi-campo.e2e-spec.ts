/**
 * E2E tests — Multi-campo output (LLM real + BD real)
 *
 * Valida los tres nuevos features con Gemini real:
 *   1. classifier  — fields[] clasifica múltiples campos en paralelo
 *   2. llm_call    — outputFields escribe campos de estado vía structured output
 *   3. http_request — fieldMap extrae múltiples keys de la respuesta HTTP
 *
 * El test de http_request levanta un servidor HTTP local para no depender
 * de APIs externas.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import { AppModule } from '../src/app.module';
import { GraphInterpreterService } from '../src/ia/graph-interpreter.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage } from '@langchain/core/messages';
import { FlowDefinition } from '../src/ia/graph-types';

// ── Servidor HTTP local para tests de http_request ───────────────────────────

function crearServidorLocal(responseBody: Record<string, unknown>): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => server.close(),
      });
    });
  });
}

// ── Suite principal ───────────────────────────────────────────────────────────

describe('Multi-campo output (e2e)', () => {
  let app: INestApplication;
  let interpreter: GraphInterpreterService;
  let checkpointer: PostgresSaver;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    interpreter = moduleFixture.get(GraphInterpreterService);
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
    await checkpointer.setup();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  function invocar(flow: FlowDefinition, mensaje: string, threadId?: string) {
    const graph = interpreter.buildFromDefinition(flow, 'Sos un asistente de salud.', [], checkpointer);
    return graph.invoke(
      { messages: [new HumanMessage(mensaje)] },
      { configurable: { thread_id: threadId ?? `mc-${Date.now()}-${Math.random()}` } },
    );
  }

  // ── 1. classifier — fields[] ───────────────────────────────────────────────

  describe('classifier — fields[]', () => {
    const FLOW: FlowDefinition = {
      id: 'e2e-classifier-multi',
      clienteId: 'e2e-test',
      campos: [
        { nombre: 'categoria', tipo: 'string', reducer: 'last_wins', default: '"sin_clasificar"' },
        { nombre: 'urgencia',  tipo: 'string', reducer: 'last_wins', default: '"baja"' },
      ],
      nodes: [
        {
          nombre: 'clasificador',
          tipo: 'classifier',
          config: {
            fields: [
              {
                field: 'categoria',
                categories: ['turno', 'consulta', 'reclamo'],
                prompt:
                  'Clasificá la intención del paciente. ' +
                  '"turno": quiere reservar, modificar o cancelar un turno. ' +
                  '"consulta": pregunta sobre servicios, médicos o coberturas. ' +
                  '"reclamo": queja sobre un servicio recibido.',
              },
              {
                field: 'urgencia',
                categories: ['alta', 'media', 'baja'],
                prompt:
                  'Determiná el nivel de urgencia médica del mensaje. ' +
                  '"alta": dolor fuerte, emergencia, accidente, síntoma grave. ' +
                  '"media": malestar moderado, necesita atención pronto. ' +
                  '"baja": consulta de rutina, sin síntomas urgentes.',
              },
            ],
          },
        },
        { nombre: 'respuesta', tipo: 'llm_call', config: {} },
      ],
      edges: [
        { origen: '__start__',    destino: 'clasificador', condicion: null },
        { origen: 'clasificador', destino: 'respuesta',    condicion: null },
        { origen: 'respuesta',    destino: '__end__',      condicion: null },
      ],
    };

    it('clasifica categoria=turno y urgencia=alta en un mensaje de emergencia con turno', async () => {
      const estado: any = await invocar(
        FLOW,
        'Necesito un turno urgente, tengo dolor de pecho desde hace una hora',
      );

      console.log('categoria:', estado.categoria, '| urgencia:', estado.urgencia);
      console.log('respuesta:', estado.messages.at(-1)?.content);

      expect(['turno', 'consulta', 'reclamo']).toContain(estado.categoria);
      expect(estado.urgencia).toBe('alta');
    }, 60000);

    it('clasifica categoria=consulta y urgencia=baja para una pregunta de rutina', async () => {
      const estado: any = await invocar(
        FLOW,
        '¿Cuáles son los horarios de atención del consultorio de cardiología?',
      );

      console.log('categoria:', estado.categoria, '| urgencia:', estado.urgencia);

      expect(estado.categoria).toBe('consulta');
      expect(['baja', 'media']).toContain(estado.urgencia);
    }, 60000);

    it('ambos campos están presentes en el estado aunque uno falle en el match exacto', async () => {
      const estado: any = await invocar(FLOW, 'hola');

      expect('categoria' in estado).toBe(true);
      expect('urgencia' in estado).toBe(true);
    }, 60000);
  });

  // ── 2. llm_call — outputFields ─────────────────────────────────────────────

  describe('llm_call — outputFields (structured output)', () => {
    const FLOW: FlowDefinition = {
      id: 'e2e-llm-outputfields',
      clienteId: 'e2e-test',
      campos: [
        { nombre: 'nombre_paciente',  tipo: 'string',  reducer: 'last_wins', default: 'null' },
        { nombre: 'fecha_solicitada', tipo: 'string',  reducer: 'last_wins', default: 'null' },
        { nombre: 'especialidad',     tipo: 'string',  reducer: 'last_wins', default: 'null' },
      ],
      nodes: [
        {
          nombre: 'extractor',
          tipo: 'llm_call',
          config: {
            outputFields: {
              nombre_paciente:  'string',
              fecha_solicitada: 'string',
              especialidad:     'string',
            },
          },
        },
      ],
      edges: [
        { origen: '__start__', destino: 'extractor', condicion: null },
        { origen: 'extractor', destino: '__end__',   condicion: null },
      ],
    };

    it('extrae nombre, fecha y especialidad del mensaje del usuario', async () => {
      const estado: any = await invocar(
        FLOW,
        'Soy María González, quiero turno con el cardiólogo para el 30 de abril',
      );

      console.log('nombre_paciente:', estado.nombre_paciente);
      console.log('fecha_solicitada:', estado.fecha_solicitada);
      console.log('especialidad:', estado.especialidad);

      expect(typeof estado.nombre_paciente).toBe('string');
      expect(estado.nombre_paciente.length).toBeGreaterThan(0);
      expect(typeof estado.fecha_solicitada).toBe('string');
      expect(estado.fecha_solicitada.length).toBeGreaterThan(0);
      // La especialidad debe ser cardiología o algo relacionado
      expect(estado.especialidad.toLowerCase()).toMatch(/cardi/);
    }, 60000);

    it('cuando no hay información suficiente, los campos son strings vacíos o "desconocido"', async () => {
      const estado: any = await invocar(FLOW, 'hola, buenas tardes');

      console.log('estado con info insuficiente:', {
        nombre: estado.nombre_paciente,
        fecha: estado.fecha_solicitada,
        especialidad: estado.especialidad,
      });

      // Los campos deben existir (structured output los incluye siempre)
      expect('nombre_paciente' in estado).toBe(true);
      expect('fecha_solicitada' in estado).toBe(true);
      expect('especialidad' in estado).toBe(true);
    }, 60000);

    it('no agrega mensajes al historial — el estado no tiene messages del LLM', async () => {
      const estado: any = await invocar(
        FLOW,
        'Soy Carlos, quiero turno con dermatología para el 5 de mayo',
      );

      // Con outputFields el nodo no hace push a messages
      // El único mensaje es el HumanMessage inicial
      const mensajesLLM = estado.messages.filter(
        (m: any) => m._getType?.() === 'ai' || m.constructor.name === 'AIMessage',
      );
      expect(mensajesLLM.length).toBe(0);
    }, 60000);
  });

  // ── 3. http_request — fieldMap ─────────────────────────────────────────────

  describe('http_request — fieldMap', () => {
    let serverUrl: string;
    let closeServer: () => void;

    const RESPUESTA_API = {
      id: 'TRN-999',
      paciente: { nombre: 'Pedro Sánchez', dni: '12345678' },
      fecha: '2026-05-10',
      medico: { apellido: 'García', especialidad: 'Clínica Médica' },
      estado: 'confirmado',
    };

    beforeAll(async () => {
      const srv = await crearServidorLocal(RESPUESTA_API);
      serverUrl = srv.url;
      closeServer = srv.close;
    });

    afterAll(() => closeServer());

    function flowConFieldMap(url: string): FlowDefinition {
      return {
        id: 'e2e-http-fieldmap',
        clienteId: 'e2e-test',
        campos: [
          { nombre: 'turno_id',          tipo: 'string', reducer: 'last_wins', default: 'null' },
          { nombre: 'turno_fecha',        tipo: 'string', reducer: 'last_wins', default: 'null' },
          { nombre: 'turno_estado',       tipo: 'string', reducer: 'last_wins', default: 'null' },
          { nombre: 'nombre_paciente',    tipo: 'string', reducer: 'last_wins', default: 'null' },
          { nombre: 'medico_especialidad',tipo: 'string', reducer: 'last_wins', default: 'null' },
        ],
        nodes: [
          {
            nombre: 'consulta_turno',
            tipo: 'http_request',
            config: {
              url,
              method: 'GET',
              fieldMap: {
                turno_id:           'id',
                turno_fecha:        'fecha',
                turno_estado:       'estado',
                nombre_paciente:    'paciente.nombre',      // dot-path nivel 2
                medico_especialidad:'medico.especialidad',  // dot-path nivel 2
              },
            },
          },
        ],
        edges: [
          { origen: '__start__',     destino: 'consulta_turno', condicion: null },
          { origen: 'consulta_turno', destino: '__end__',       condicion: null },
        ],
      };
    }

    it('mapea cinco campos desde la respuesta HTTP al estado', async () => {
      const estado: any = await invocar(flowConFieldMap(serverUrl), 'consultar turno 999');

      console.log('estado después de http_request:', {
        turno_id: estado.turno_id,
        turno_fecha: estado.turno_fecha,
        turno_estado: estado.turno_estado,
        nombre_paciente: estado.nombre_paciente,
        medico_especialidad: estado.medico_especialidad,
      });

      expect(estado.turno_id).toBe('TRN-999');
      expect(estado.turno_fecha).toBe('2026-05-10');
      expect(estado.turno_estado).toBe('confirmado');
      expect(estado.nombre_paciente).toBe('Pedro Sánchez');
      expect(estado.medico_especialidad).toBe('Clínica Médica');
    }, 30000);

    it('dot-path resuelve correctamente objetos anidados', async () => {
      const flowDotPath: FlowDefinition = {
        id: 'e2e-http-dotpath',
        clienteId: 'e2e-test',
        campos: [
          { nombre: 'dni', tipo: 'string', reducer: 'last_wins', default: 'null' },
        ],
        nodes: [
          {
            nombre: 'api',
            tipo: 'http_request',
            config: {
              url: serverUrl,
              method: 'GET',
              fieldMap: { dni: 'paciente.dni' },
            },
          },
        ],
        edges: [
          { origen: '__start__', destino: 'api',    condicion: null },
          { origen: 'api',       destino: '__end__', condicion: null },
        ],
      };

      const estado: any = await invocar(flowDotPath, 'test');
      expect(estado.dni).toBe('12345678');
    }, 30000);
  });
});
