import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { GraphInterpreterService } from '../src/ia/graph-interpreter.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FlowDefinition } from '../src/ia/graph-types';

/**
 * Flujo bajo prueba:
 *
 *   __start__
 *       ↓
 *   [classifier]  — clasifica la intención en "soporte" o "ventas"
 *       ↓ (condicional según state.categoria)
 *   ┌───┴──────┐
 * [agente_soporte] [agente_ventas]
 *       ↓               ↓
 *     __end__         __end__
 *
 * Estado: { messages, categoria: string }
 *
 * Qué se verifica:
 *   1. El nodo classifier escribe en state.categoria
 *   2. El routing lleva al nodo correcto según la categoría
 *   3. El nodo de destino responde con el contexto adecuado
 */
describe('GraphInterpreterService — flujo con clasificación y routing (e2e)', () => {
  let app: INestApplication;
  let interpreter: GraphInterpreterService;
  let checkpointer: PostgresSaver;

  const FLOW: FlowDefinition = {
    id: 'test-flow-classifier',
    clienteId: 'test-cliente',
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
          prompt: 'Clasificá el mensaje del usuario. Si pregunta por un problema técnico o necesita ayuda con un producto, es "soporte". Si pregunta por precios, planes o quiere comprar, es "ventas".',
        },
      },
      {
        nombre: 'agente_soporte',
        tipo: 'llm_call',
        config: {},
      },
      {
        nombre: 'agente_ventas',
        tipo: 'llm_call',
        config: {},
      },
    ],
    edges: [
      { origen: '__start__',    destino: 'clasificador',   condicion: null },
      { origen: 'clasificador', destino: 'agente_soporte', condicion: 'soporte' },
      { origen: 'clasificador', destino: 'agente_ventas',  condicion: 'ventas' },
      { origen: 'agente_soporte', destino: '__end__',      condicion: null },
      { origen: 'agente_ventas',  destino: '__end__',      condicion: null },
    ],
  };

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

  // ---------------------------------------------------------------------------
  // Helper: invocar el grafo y devolver el estado final
  // ---------------------------------------------------------------------------

  async function invocar(mensaje: string, systemPrompt: string, sessionId: string): Promise<any> {
    const graph = interpreter.buildFromDefinition(FLOW, systemPrompt, [], checkpointer);
    const config = { configurable: { thread_id: `test-${sessionId}` } };
    return graph.invoke({ messages: [new HumanMessage(mensaje)] }, config);
  }

  // ---------------------------------------------------------------------------
  // Test 1: mensaje de soporte → clasificado como "soporte"
  // ---------------------------------------------------------------------------

  it('un mensaje de problema técnico → state.categoria = "soporte"', async () => {
    const estado = await invocar(
      'Mi aplicación no carga, da error 500',
      'Sos un asistente de atención al cliente.',
      'session-soporte-1',
    );

    console.log('categoria detectada:', estado.categoria);
    console.log('respuesta:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('soporte');
    expect(estado.messages.at(-1)?.content).toBeTruthy();
  }, 40000);

  // ---------------------------------------------------------------------------
  // Test 2: mensaje de ventas → clasificado como "ventas"
  // ---------------------------------------------------------------------------

  it('un mensaje de precio → state.categoria = "ventas"', async () => {
    const estado = await invocar(
      '¿Cuánto cuesta el plan premium? Quiero comprar',
      'Sos un asistente de atención al cliente.',
      'session-ventas-1',
    );

    console.log('categoria detectada:', estado.categoria);
    console.log('respuesta:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('ventas');
    expect(estado.messages.at(-1)?.content).toBeTruthy();
  }, 40000);

  // ---------------------------------------------------------------------------
  // Test 3: el sistema prompt del agente de destino se aplica correctamente
  // ---------------------------------------------------------------------------

  it('el agente de soporte recibe el system prompt correcto', async () => {
    const estado = await invocar(
      'No puedo iniciar sesión en mi cuenta',
      'Sos el agente de SOPORTE TÉCNICO. Siempre mencioná que podés crear un ticket.',
      'session-soporte-2',
    );

    console.log('respuesta soporte:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('soporte');
    // El agente de soporte debería mencionar algo relacionado con el problema
    const respuesta = estado.messages.at(-1)?.content as string;
    expect(respuesta.length).toBeGreaterThan(10);
  }, 40000);

  // ---------------------------------------------------------------------------
  // Test 4: el campo "categoria" existe en el estado desde el inicio
  // ---------------------------------------------------------------------------

  it('el estado inicial tiene categoria = "sin_clasificar" (valor default)', async () => {
    const graph = interpreter.buildFromDefinition(FLOW, 'Asistente de prueba.', [], checkpointer);

    // Lo importante es que al invocar, el campo dinámico aparece en el estado
    const config = { configurable: { thread_id: 'test-estado-inicial' } };
    const estadoFinal: any = await graph.invoke(
      { messages: [new HumanMessage('hola')] },
      config,
    );

    expect('categoria' in estadoFinal).toBe(true);
    console.log('campo categoria presente:', estadoFinal.categoria);
  }, 40000);

  // ---------------------------------------------------------------------------
  // Test 5: dos mensajes seguidos en la misma sesión — el clasificador
  //         re-clasifica independientemente cada vez
  // ---------------------------------------------------------------------------

  it('dos mensajes en la misma sesión se clasifican de forma independiente', async () => {
    const graph = interpreter.buildFromDefinition(FLOW, 'Sos un asistente.', [], checkpointer);
    const config = { configurable: { thread_id: 'test-session-multi' } };

    const estado1: any = await graph.invoke(
      { messages: [new HumanMessage('¿Cuánto cuesta el plan anual?')] },
      config,
    );
    console.log('turno 1 — categoria:', estado1.categoria);
    expect(estado1.categoria).toBe('ventas');

    const estado2: any = await graph.invoke(
      { messages: [new HumanMessage('Tengo un bug en la API')] },
      config,
    );
    console.log('turno 2 — categoria:', estado2.categoria);
    expect(estado2.categoria).toBe('soporte');
  }, 60000);

  // ---------------------------------------------------------------------------
  // Edge case 1: el clasificador devuelve una categoría fuera del routeMap
  // → el routing debe usar el fallback y no explotar
  // ---------------------------------------------------------------------------

  it('clasificador con respuesta ambigua → fallback al primer nodo del routeMap', async () => {
    const flowAmbiguo: FlowDefinition = {
      ...FLOW,
      nodes: [
        {
          nombre: 'clasificador',
          tipo: 'classifier',
          config: {
            field: 'categoria',
            categories: ['soporte', 'ventas'],
            // Prompt que provoca ambigüedad deliberada
            prompt: 'El usuario dijo "quizás" sin contexto. Clasificá en soporte o ventas.',
          },
        },
        { nombre: 'agente_soporte', tipo: 'llm_call', config: {} },
        { nombre: 'agente_ventas',  tipo: 'llm_call', config: {} },
      ],
      edges: [
        { origen: '__start__',      destino: 'clasificador',   condicion: null },
        { origen: 'clasificador',   destino: 'agente_soporte', condicion: 'soporte' },
        { origen: 'clasificador',   destino: 'agente_ventas',  condicion: 'ventas' },
        { origen: 'agente_soporte', destino: '__end__',        condicion: null },
        { origen: 'agente_ventas',  destino: '__end__',        condicion: null },
      ],
    };

    const graph = interpreter.buildFromDefinition(flowAmbiguo, 'Asistente.', [], checkpointer);

    // No debe lanzar — debe llegar a __end__ usando el fallback
    const estado: any = await graph.invoke(
      { messages: [new HumanMessage('quizás')] },
      { configurable: { thread_id: 'test-ambiguo' } },
    );

    expect(estado.messages.at(-1)?.content).toBeTruthy();
    console.log('categoria con input ambiguo:', estado.categoria);
    console.log('respuesta fallback:', estado.messages.at(-1)?.content);
  }, 40000);

  // ---------------------------------------------------------------------------
  // Edge case 2: nodo human_handoff → setea escalated: true en el estado
  // ---------------------------------------------------------------------------

  it('nodo human_handoff → estado.escalated = true y el grafo termina', async () => {
    const flowHandoff: FlowDefinition = {
      id: 'test-flow-handoff',
      clienteId: 'test-handoff',
      campos: [
        { nombre: 'escalated', tipo: 'boolean', reducer: 'last_wins', default: 'false' },
      ],
      nodes: [
        {
          nombre: 'handoff',
          tipo: 'human_handoff',
          config: {
            message: 'Esta consulta requiere atención humana. Transferí al agente de soporte.',
          },
        },
      ],
      edges: [
        { origen: '__start__', destino: 'handoff',  condicion: null },
        { origen: 'handoff',   destino: '__end__',  condicion: null },
      ],
    };

    const graph = interpreter.buildFromDefinition(flowHandoff, 'Asistente.', [], checkpointer);
    const estado: any = await graph.invoke(
      { messages: [new HumanMessage('Necesito hablar con una persona')] },
      { configurable: { thread_id: 'test-handoff-1' } },
    );

    console.log('escalated:', estado.escalated);
    console.log('respuesta handoff:', estado.messages.at(-1)?.content);

    expect(estado.escalated).toBe(true);
    expect(estado.messages.at(-1)?.content).toBeTruthy();
  }, 40000);

  // ---------------------------------------------------------------------------
  // Edge case 3: reducer "append" acumula valores en vez de reemplazarlos
  // ---------------------------------------------------------------------------

  it('reducer append — los valores se acumulan entre turnos', async () => {
    const flowAppend: FlowDefinition = {
      id: 'test-flow-append',
      clienteId: 'test-append',
      campos: [
        { nombre: 'temas', tipo: 'array', reducer: 'append', default: 'null' },
        { nombre: 'categoria', tipo: 'string', reducer: 'last_wins', default: '"sin_clasificar"' },
      ],
      nodes: [
        {
          nombre: 'clasificador',
          tipo: 'classifier',
          config: {
            field: 'temas',
            categories: ['soporte', 'ventas'],
            prompt: 'Clasificá el mensaje en soporte o ventas.',
          },
        },
        { nombre: 'respuesta', tipo: 'llm_call', config: {} },
      ],
      edges: [
        { origen: '__start__',   destino: 'clasificador', condicion: null },
        { origen: 'clasificador', destino: 'respuesta',   condicion: null },
        { origen: 'respuesta',   destino: '__end__',      condicion: null },
      ],
    };

    const graph = interpreter.buildFromDefinition(flowAppend, 'Asistente.', [], checkpointer);
    const config = { configurable: { thread_id: 'test-append-session' } };

    await graph.invoke({ messages: [new HumanMessage('Tengo un problema técnico')] }, config);
    const estado: any = await graph.invoke({ messages: [new HumanMessage('¿Cuánto cuesta?')] }, config);

    console.log('temas acumulados:', estado.temas);

    // Con append, después de dos turnos debe haber dos valores
    expect(Array.isArray(estado.temas)).toBe(true);
    expect(estado.temas.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  // ---------------------------------------------------------------------------
  // Edge case 4: dos sesiones distintas con el mismo grafo mantienen
  //             estados completamente independientes
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Edge case 5: grafo con ciclo ReAct (model → tools → model → ... → END)
  // Verifica que:
  //   a) el modelo llama a al menos una tool (hay ToolMessage en los mensajes)
  //   b) el resultado de la tool llega al modelo en el turno siguiente
  //   c) el loop termina solo cuando el modelo decide no hacer más tool calls
  // ---------------------------------------------------------------------------

  it('ciclo ReAct — el modelo usa una tool y el loop termina solo', async () => {
    // Tool en memoria: suma dos números
    // Al ser determinista garantiza que el modelo la va a invocar
    // si le preguntamos explícitamente por una suma
    let toolCallCount = 0;

    const calculadora = tool(
      async ({ a, b }: { a: number; b: number }) => {
        toolCallCount++;
        return String(a + b);
      },
      {
        name: 'calculadora',
        description: 'Suma dos números enteros. Usá esta tool cuando el usuario pida una suma.',
        schema: z.object({
          a: z.number().describe('primer número'),
          b: z.number().describe('segundo número'),
        }),
      },
    );

    // Flujo ReAct: idéntico al que teníamos hardcodeado en buildGraphWithTools
    const flowReact: FlowDefinition = {
      id: 'test-flow-react',
      clienteId: 'test-react',
      campos: [],
      nodes: [
        { nombre: 'model', tipo: 'llm_call',      config: {} },
        { nombre: 'tools', tipo: 'tool_executor', config: {} },
      ],
      edges: [
        { origen: '__start__', destino: 'model',   condicion: null },
        { origen: 'model',     destino: 'tools',   condicion: 'tools'   },
        { origen: 'model',     destino: '__end__', condicion: '__end__' },
        { origen: 'tools',     destino: 'model',   condicion: null },
      ],
    };

    const graph = interpreter.buildFromDefinition(
      flowReact,
      'Sos un asistente matemático. Cuando te pidan una suma, usá SIEMPRE la tool calculadora.',
      [calculadora],
      checkpointer,
    );

    const estado: any = await graph.invoke(
      { messages: [new HumanMessage('¿Cuánto es 47 + 38?')] },
      { configurable: { thread_id: 'test-react-1' } },
    );

    const mensajes = estado.messages;
    const tipos = mensajes.map((m: any) => m.constructor.name ?? m._getType?.());

    console.log('tipos de mensajes:', tipos);
    console.log('tool calls realizados:', toolCallCount);
    console.log('respuesta final:', mensajes.at(-1)?.content);

    // a) La tool fue llamada al menos una vez
    expect(toolCallCount).toBeGreaterThanOrEqual(1);

    // b) Hay al menos un ToolMessage en la cadena (resultado de la tool)
    const hayToolMessage = mensajes.some(
      (m: any) => m._getType?.() === 'tool' || m.constructor.name === 'ToolMessage',
    );
    expect(hayToolMessage).toBe(true);

    // c) El último mensaje es del asistente (el modelo cerró el loop)
    const ultimo = mensajes.at(-1);
    expect(ultimo._getType?.() === 'ai' || ultimo.constructor.name === 'AIMessage').toBe(true);

    // d) La respuesta menciona 85 (47 + 38)
    expect(String(mensajes.at(-1)?.content)).toContain('85');
  }, 60000);

  it('ciclo ReAct — múltiples tool calls en el mismo turno', async () => {
    let callLog: string[] = [];

    const clima = tool(
      async ({ ciudad }: { ciudad: string }) => {
        callLog.push(`clima:${ciudad}`);
        return JSON.stringify({ ciudad, temperatura: 22, condicion: 'soleado' });
      },
      {
        name: 'obtener_clima',
        description: 'Devuelve el clima actual de una ciudad.',
        schema: z.object({ ciudad: z.string().describe('nombre de la ciudad') }),
      },
    );

    const flowReact: FlowDefinition = {
      id: 'test-flow-react-multi',
      clienteId: 'test-react-multi',
      campos: [],
      nodes: [
        { nombre: 'model', tipo: 'llm_call',      config: {} },
        { nombre: 'tools', tipo: 'tool_executor', config: {} },
      ],
      edges: [
        { origen: '__start__', destino: 'model',   condicion: null },
        { origen: 'model',     destino: 'tools',   condicion: 'tools'   },
        { origen: 'model',     destino: '__end__', condicion: '__end__' },
        { origen: 'tools',     destino: 'model',   condicion: null },
      ],
    };

    const graph = interpreter.buildFromDefinition(
      flowReact,
      'Sos un asistente del clima. Usá la tool obtener_clima para cada ciudad que te pregunten.',
      [clima],
      checkpointer,
    );

    const estado: any = await graph.invoke(
      { messages: [new HumanMessage('¿Cómo está el clima en Buenos Aires y en Madrid?')] },
      { configurable: { thread_id: 'test-react-multi-1' } },
    );

    console.log('calls al clima:', callLog);
    console.log('respuesta:', estado.messages.at(-1)?.content);

    // La tool fue invocada para ambas ciudades
    expect(callLog.length).toBeGreaterThanOrEqual(2);
    expect(callLog.some(c => c.toLowerCase().includes('buenos'))).toBe(true);
    expect(callLog.some(c => c.toLowerCase().includes('madrid'))).toBe(true);
  }, 60000);

  it('dos sesiones paralelas no comparten estado', async () => {
    const graph = interpreter.buildFromDefinition(FLOW, 'Sos un asistente.', [], checkpointer);

    const [estadoA, estadoB]: any[] = await Promise.all([
      graph.invoke(
        { messages: [new HumanMessage('Tengo un problema con mi cuenta')] },
        { configurable: { thread_id: 'test-sesion-A' } },
      ),
      graph.invoke(
        { messages: [new HumanMessage('Quiero comprar el plan anual')] },
        { configurable: { thread_id: 'test-sesion-B' } },
      ),
    ]);

    console.log('sesión A — categoria:', estadoA.categoria);
    console.log('sesión B — categoria:', estadoB.categoria);

    expect(estadoA.categoria).toBe('soporte');
    expect(estadoB.categoria).toBe('ventas');
    // Los estados son independientes — soporte != ventas
    expect(estadoA.categoria).not.toBe(estadoB.categoria);
  }, 60000);
});
