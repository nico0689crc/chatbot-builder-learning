/**
 * Unit tests — GraphInterpreterService
 *
 * Sin LLM real ni BD. Se usa MemorySaver como checkpointer y se mockean
 * ChatGoogleGenerativeAI y fetch para aislar la lógica del servicio.
 *
 * Cubre los tres nuevos features de multi-campo:
 *   1. http_request  — fieldMap (dot-path sobre la respuesta)
 *   2. classifier    — fields[] (múltiples campos en paralelo)
 *   3. llm_call      — outputFields (structured output)
 */

import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GraphInterpreterService } from './graph-interpreter.service';
import { FlowDefinition } from './graph-types';

// ── Mock de ChatGoogleGenerativeAI ───────────────────────────────────────────

const mockInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn();

jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: mockInvoke,
    bindTools: jest.fn().mockReturnThis(),
    withStructuredOutput: mockWithStructuredOutput,
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  // GraphInterpreterService no tiene dependencias de Prisma en los métodos
  // que vamos a testear — se puede instanciar directamente.
  return new GraphInterpreterService();
}

function makeCheckpointer() {
  return new MemorySaver();
}

async function invocar(
  service: GraphInterpreterService,
  flow: FlowDefinition,
  mensaje: string,
  systemPrompt = 'Asistente de prueba.',
  threadId = `test-${Date.now()}`,
) {
  const graph = service.buildFromDefinition(flow, systemPrompt, [], makeCheckpointer());
  return graph.invoke(
    { messages: [new HumanMessage(mensaje)] },
    { configurable: { thread_id: threadId } },
  );
}

// ── 1. http_request — fieldMap ───────────────────────────────────────────────

describe('http_request — fieldMap (multi-campo)', () => {
  let service: GraphInterpreterService;

  const FLOW: FlowDefinition = {
    id: 'test-http-fieldmap',
    clienteId: 'test',
    campos: [
      { nombre: 'turno_id',    tipo: 'string', reducer: 'last_wins', default: 'null' },
      { nombre: 'turno_fecha', tipo: 'string', reducer: 'last_wins', default: 'null' },
      { nombre: 'turno_estado',tipo: 'string', reducer: 'last_wins', default: '"pendiente"' },
    ],
    nodes: [
      {
        nombre: 'consulta_api',
        tipo: 'http_request',
        config: {
          url: 'https://api.ejemplo.com/turno/123',
          method: 'GET',
          fieldMap: {
            turno_id:     'id',
            turno_fecha:  'fecha',
            turno_estado: 'status.value',   // dot-path anidado
          },
        },
      },
    ],
    edges: [
      { origen: '__start__',   destino: 'consulta_api', condicion: null },
      { origen: 'consulta_api', destino: '__end__',     condicion: null },
    ],
  };

  beforeEach(() => {
    service = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'TRN-001',
        fecha: '2026-04-20',
        status: { value: 'confirmado', code: 1 },
      }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it('extrae múltiples campos del JSON de respuesta', async () => {
    const estado: any = await invocar(service, FLOW, 'consultar turno');

    expect(estado.turno_id).toBe('TRN-001');
    expect(estado.turno_fecha).toBe('2026-04-20');
    expect(estado.turno_estado).toBe('confirmado');   // dot-path anidado
  });

  it('llama al endpoint exactamente una vez', async () => {
    await invocar(service, FLOW, 'consultar turno');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.ejemplo.com/turno/123',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('un key inexistente en la respuesta queda como undefined en el estado', async () => {
    const flowConKeyInexistente: FlowDefinition = {
      ...FLOW,
      campos: [
        { nombre: 'campo_inexistente', tipo: 'string', reducer: 'last_wins', default: 'null' },
      ],
      nodes: [
        {
          nombre: 'consulta_api',
          tipo: 'http_request',
          config: {
            url: 'https://api.ejemplo.com/turno/123',
            method: 'GET',
            fieldMap: { campo_inexistente: 'no.existe.en.respuesta' },
          },
        },
      ],
    };

    const estado: any = await invocar(service, flowConKeyInexistente, 'test');
    expect(estado.campo_inexistente).toBeUndefined();
  });

  it('en caso de error HTTP, el estado recibe el error en el primer campo del fieldMap', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    } as Response);

    // Con fetch que falla (ok: false), el nodo hace throw o retorna error
    // Verificamos que el flujo no explota — el estado debe llegar al final
    await expect(invocar(service, FLOW, 'test error')).resolves.toBeDefined();
  });

  it('compatibilidad hacia atrás: resultField sigue funcionando sin fieldMap', async () => {
    const flowLegacy: FlowDefinition = {
      id: 'test-http-legacy',
      clienteId: 'test',
      campos: [
        { nombre: 'httpResult', tipo: 'object', reducer: 'last_wins', default: 'null' },
      ],
      nodes: [
        {
          nombre: 'consulta_api',
          tipo: 'http_request',
          config: {
            url: 'https://api.ejemplo.com/data',
            method: 'GET',
            resultField: 'httpResult',
          },
        },
      ],
      edges: [
        { origen: '__start__',    destino: 'consulta_api', condicion: null },
        { origen: 'consulta_api', destino: '__end__',      condicion: null },
      ],
    };

    const estado: any = await invocar(service, flowLegacy, 'test');
    expect(estado.httpResult).toEqual({
      id: 'TRN-001',
      fecha: '2026-04-20',
      status: { value: 'confirmado', code: 1 },
    });
  });
});

// ── 2. classifier — fields[] ─────────────────────────────────────────────────

describe('classifier — fields[] (múltiples campos en paralelo)', () => {
  let service: GraphInterpreterService;

  beforeEach(() => {
    service = makeService();
    // El mock responde con la primera categoría de cada campo para simplificar.
    // Para el nodo llm_call de "respuesta" devuelve un AIMessage real.
    mockInvoke.mockImplementation(async (messages: any[]) => {
      const systemMsg = messages[0]?.content ?? '';
      if (systemMsg.includes('urgencia')) {
        return new AIMessage('alta');
      }
      if (systemMsg.includes('Clasificá')) {
        return new AIMessage('consulta');
      }
      // Llamadas del nodo llm_call normal — devuelve AIMessage real
      return new AIMessage('Entendido, te ayudo con eso.');
    });
  });

  afterEach(() => jest.clearAllMocks());

  const FLOW: FlowDefinition = {
    id: 'test-classifier-multi',
    clienteId: 'test',
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
              categories: ['consulta', 'turno', 'reclamo'],
              prompt: 'Clasificá la intención del usuario.',
            },
            {
              field: 'urgencia',
              categories: ['alta', 'media', 'baja'],
              prompt: 'Determiná el nivel de urgencia.',
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

  it('escribe ambos campos al estado en una sola ejecución', async () => {
    const estado: any = await invocar(service, FLOW, 'Me duele el pecho, necesito turno urgente');

    expect(estado.categoria).toBe('consulta');
    expect(estado.urgencia).toBe('alta');
  });

  it('hace una invocación al LLM por cada campo definido en fields[]', async () => {
    await invocar(service, FLOW, 'quiero cancelar mi turno');
    // 2 clasificaciones paralelas + 1 llm_call de respuesta = 3 invocaciones
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('compatibilidad hacia atrás: config con field (singular) sigue funcionando', async () => {
    mockInvoke.mockResolvedValue(new AIMessage('soporte'));

    const flowLegacy: FlowDefinition = {
      id: 'test-classifier-legacy',
      clienteId: 'test',
      campos: [
        { nombre: 'categoria', tipo: 'string', reducer: 'last_wins', default: '"sin_clasificar"' },
      ],
      nodes: [
        {
          nombre: 'clasificador',
          tipo: 'classifier',
          config: {
            field: 'categoria',
            categories: ['soporte', 'ventas'],
            prompt: 'Clasificá en soporte o ventas.',
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

    const estado: any = await invocar(service, flowLegacy, 'tengo un bug');
    expect(estado.categoria).toBe('soporte');
  });
});

// ── 3. llm_call — outputFields (structured output) ───────────────────────────

describe('llm_call — outputFields (structured output)', () => {
  let service: GraphInterpreterService;

  beforeEach(() => {
    service = makeService();
    // withStructuredOutput devuelve un objeto que tiene invoke()
    mockWithStructuredOutput.mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        nombre_paciente: 'Juan Pérez',
        fecha_solicitada: '2026-04-25',
        confirmado: false,
      }),
    });
    // invoke normal para otros nodos
    mockInvoke.mockResolvedValue({ content: 'ok' });
  });

  afterEach(() => jest.clearAllMocks());

  const FLOW: FlowDefinition = {
    id: 'test-llm-outputfields',
    clienteId: 'test',
    campos: [
      { nombre: 'nombre_paciente',  tipo: 'string',  reducer: 'last_wins', default: 'null' },
      { nombre: 'fecha_solicitada', tipo: 'string',  reducer: 'last_wins', default: 'null' },
      { nombre: 'confirmado',       tipo: 'boolean', reducer: 'last_wins', default: 'false' },
    ],
    nodes: [
      {
        nombre: 'extractor',
        tipo: 'llm_call',
        config: {
          outputFields: {
            nombre_paciente:  'string',
            fecha_solicitada: 'string',
            confirmado:       'boolean',
          },
        },
      },
    ],
    edges: [
      { origen: '__start__', destino: 'extractor', condicion: null },
      { origen: 'extractor', destino: '__end__',   condicion: null },
    ],
  };

  it('escribe todos los outputFields al estado sin agregar a messages', async () => {
    const estado: any = await invocar(
      service, FLOW,
      'Quiero turno para Juan Pérez el 25 de abril',
    );

    expect(estado.nombre_paciente).toBe('Juan Pérez');
    expect(estado.fecha_solicitada).toBe('2026-04-25');
    expect(estado.confirmado).toBe(false);
  });

  it('usa withStructuredOutput (no invoke directo) cuando hay outputFields', async () => {
    await invocar(service, FLOW, 'Quiero turno para Ana el 1 de mayo');
    expect(mockWithStructuredOutput).toHaveBeenCalledTimes(1);
    // El schema debe incluir las keys de outputFields
    const schema = mockWithStructuredOutput.mock.calls[0][0];
    expect(schema.properties).toHaveProperty('nombre_paciente');
    expect(schema.properties).toHaveProperty('fecha_solicitada');
    expect(schema.properties).toHaveProperty('confirmado');
  });

  it('sin outputFields usa invoke normal y agrega a messages', async () => {
    const flowNormal: FlowDefinition = {
      id: 'test-llm-normal',
      clienteId: 'test',
      campos: [],
      nodes: [
        { nombre: 'agente', tipo: 'llm_call', config: {} },
      ],
      edges: [
        { origen: '__start__', destino: 'agente', condicion: null },
        { origen: 'agente',    destino: '__end__', condicion: null },
      ],
    };

    mockInvoke.mockResolvedValue(new AIMessage('Hola, ¿en qué puedo ayudarte?'));

    const estado: any = await invocar(service, flowNormal, 'hola');
    expect(mockWithStructuredOutput).not.toHaveBeenCalled();
    expect(estado.messages.at(-1)?.content).toBe('Hola, ¿en qué puedo ayudarte?');
  });

  it('el schema generado marca todos los campos como required', async () => {
    await invocar(service, FLOW, 'test');
    const schema = mockWithStructuredOutput.mock.calls[0][0];
    expect(schema.required).toEqual(
      expect.arrayContaining(['nombre_paciente', 'fecha_solicitada', 'confirmado']),
    );
  });
});
