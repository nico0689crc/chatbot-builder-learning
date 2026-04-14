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
 * Grafo bajo prueba — 8 nodos, 3 ramas, 2 ciclos ReAct independientes:
 *
 *                     __start__
 *                         ↓
 *                   [clasificador]          CampoEstado: categoria
 *                         ↓
 *          ┌──────────────┼──────────────┐
 *       "stock"        "precio"      "escalacion"
 *          ↓               ↓               ↓
 *   [agente_stock]  [agente_precio]   [handoff]
 *       ↓   ↑           ↓   ↑             ↓
 *  [tools_stock]   [tools_precio]       __end__
 *    (ciclo 1)       (ciclo 2)
 *       ↓               ↓
 *     __end__         __end__
 *
 * Estado: { messages, categoria: string, escalated: boolean }
 *
 * Qué se verifica:
 *   1. Routing correcto desde el clasificador a cada rama
 *   2. Ciclo 1: agente_stock llama a tool_stock y termina con dato real
 *   3. Ciclo 2: agente_precio llama a tool_precio y termina con dato real
 *   4. Rama handoff: escalated = true, no invoca tools
 *   5. Las dos sesiones con ciclos distintos no se interfieren
 *   6. Multi-turno: una sesión cambia de rama entre mensajes
 */
describe('Grafo complejo — 3 ramas + 2 ciclos ReAct (e2e)', () => {
  let app: INestApplication;
  let interpreter: GraphInterpreterService;
  let checkpointer: PostgresSaver;

  // Contadores para verificar qué tools fueron llamadas
  const calls = { stock: 0, precio: 0 };

  // ---------------------------------------------------------------------------
  // Tools en memoria
  // ---------------------------------------------------------------------------

  const toolStock = tool(
    async ({ producto }: { producto: string }) => {
      calls.stock++;
      return JSON.stringify({ producto, stock: 99, deposito: 'Córdoba' });
    },
    {
      name: 'consultar_stock',
      description: 'Devuelve el stock disponible de un producto.',
      schema: z.object({ producto: z.string().describe('nombre del producto') }),
    },
  );

  const toolPrecio = tool(
    async ({ producto }: { producto: string }) => {
      calls.precio++;
      return JSON.stringify({ producto, precio: 1500, moneda: 'USD' });
    },
    {
      name: 'consultar_precio',
      description: 'Devuelve el precio de venta de un producto.',
      schema: z.object({ producto: z.string().describe('nombre del producto') }),
    },
  );

  // ---------------------------------------------------------------------------
  // Definición del grafo complejo
  // ---------------------------------------------------------------------------

  const FLOW: FlowDefinition = {
    id: 'test-flow-complejo',
    clienteId: 'test-complejo',
    campos: [
      { nombre: 'categoria',  tipo: 'string',  reducer: 'last_wins', default: '"sin_clasificar"' },
      { nombre: 'escalated',  tipo: 'boolean', reducer: 'last_wins', default: 'false' },
    ],
    nodes: [
      {
        nombre: 'clasificador',
        tipo: 'classifier',
        config: {
          field: 'categoria',
          categories: ['stock', 'precio', 'escalacion'],
          prompt:
            'Clasificá la intención del usuario. ' +
            '"stock" si pregunta por disponibilidad o inventario. ' +
            '"precio" si pregunta por costo o valor. ' +
            '"escalacion" si quiere hablar con una persona o hacer un reclamo formal.',
        },
      },
      // Rama stock
      { nombre: 'agente_stock',  tipo: 'llm_call',      config: {} },
      { nombre: 'tools_stock',   tipo: 'tool_executor', config: {} },
      // Rama precio
      { nombre: 'agente_precio', tipo: 'llm_call',      config: {} },
      { nombre: 'tools_precio',  tipo: 'tool_executor', config: {} },
      // Rama escalacion
      {
        nombre: 'handoff',
        tipo: 'human_handoff',
        config: {
          message: 'Derivá al usuario a un agente humano de forma cordial.',
          escalatedField: 'escalated',
        },
      },
    ],
    edges: [
      // Desde __start__
      { origen: '__start__',     destino: 'clasificador',  condicion: null },

      // Routing desde clasificador
      { origen: 'clasificador',  destino: 'agente_stock',  condicion: 'stock' },
      { origen: 'clasificador',  destino: 'agente_precio', condicion: 'precio' },
      { origen: 'clasificador',  destino: 'handoff',       condicion: 'escalacion' },

      // Ciclo 1: agente_stock ↔ tools_stock
      { origen: 'agente_stock',  destino: 'tools_stock',   condicion: 'tools' },
      { origen: 'agente_stock',  destino: '__end__',       condicion: '__end__' },
      { origen: 'tools_stock',   destino: 'agente_stock',  condicion: null },

      // Ciclo 2: agente_precio ↔ tools_precio
      { origen: 'agente_precio', destino: 'tools_precio',  condicion: 'tools' },
      { origen: 'agente_precio', destino: '__end__',       condicion: '__end__' },
      { origen: 'tools_precio',  destino: 'agente_precio', condicion: null },

      // Handoff termina
      { origen: 'handoff',       destino: '__end__',       condicion: null },
    ],
  };

  const SYSTEM_PROMPT =
    'Sos un asistente de ventas. ' +
    'Para consultas de stock usá SIEMPRE consultar_stock. ' +
    'Para consultas de precio usá SIEMPRE consultar_precio. ' +
    'Nunca inventes datos — solo usá lo que devuelven las tools.';

  // ---------------------------------------------------------------------------
  // Setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication();
    await app.init();

    interpreter = fixture.get(GraphInterpreterService);
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
    await checkpointer.setup();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  function buildGraph() {
    return interpreter.buildFromDefinition(
      FLOW,
      SYSTEM_PROMPT,
      [toolStock, toolPrecio],
      checkpointer,
    );
  }

  async function chat(mensaje: string, sessionId: string): Promise<any> {
    return buildGraph().invoke(
      { messages: [new HumanMessage(mensaje)] },
      { configurable: { thread_id: `complejo-${sessionId}` } },
    );
  }

  // ---------------------------------------------------------------------------
  // Test 1: rama stock — ciclo 1 se ejecuta, tool_stock es llamada
  // ---------------------------------------------------------------------------

  it('consulta de stock → categoria=stock, ciclo ReAct con consultar_stock', async () => {
    calls.stock = 0;
    calls.precio = 0;

    const estado = await chat('¿Cuántas laptops Dell hay disponibles?', 'stock-1');

    console.log('categoria:', estado.categoria);
    console.log('calls.stock:', calls.stock, '| calls.precio:', calls.precio);
    console.log('mensajes:', estado.messages.map((m: any) => m._getType?.()));
    console.log('respuesta:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('stock');
    expect(calls.stock).toBeGreaterThanOrEqual(1);
    expect(calls.precio).toBe(0);

    // El ciclo ocurrió: HumanMessage → AIMessage → ToolMessage → AIMessage
    const tipos = estado.messages.map((m: any) => m._getType?.());
    expect(tipos).toContain('tool');

    // La respuesta menciona 99 (stock del mock)
    expect(String(estado.messages.at(-1)?.content)).toContain('99');
  }, 60000);

  // ---------------------------------------------------------------------------
  // Test 2: rama precio — ciclo 2 se ejecuta, tool_precio es llamada
  // ---------------------------------------------------------------------------

  it('consulta de precio → categoria=precio, ciclo ReAct con consultar_precio', async () => {
    calls.stock = 0;
    calls.precio = 0;

    const estado = await chat('¿Cuánto cuesta el monitor Samsung?', 'precio-1');

    console.log('categoria:', estado.categoria);
    console.log('calls.stock:', calls.stock, '| calls.precio:', calls.precio);
    console.log('respuesta:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('precio');
    expect(calls.precio).toBeGreaterThanOrEqual(1);
    expect(calls.stock).toBe(0);

    const tipos = estado.messages.map((m: any) => m._getType?.());
    expect(tipos).toContain('tool');

    // La respuesta menciona 1500 (precio del mock)
    expect(String(estado.messages.at(-1)?.content)).toContain('1500');
  }, 60000);

  // ---------------------------------------------------------------------------
  // Test 3: rama escalacion — handoff, sin tools, escalated=true
  // ---------------------------------------------------------------------------

  it('escalacion → categoria=escalacion, escalated=true, sin tool calls', async () => {
    calls.stock = 0;
    calls.precio = 0;

    const estado = await chat('Quiero hablar con una persona, tengo un reclamo formal', 'escalacion-1');

    console.log('categoria:', estado.categoria);
    console.log('escalated:', estado.escalated);
    console.log('respuesta:', estado.messages.at(-1)?.content);

    expect(estado.categoria).toBe('escalacion');
    expect(estado.escalated).toBe(true);
    expect(calls.stock).toBe(0);
    expect(calls.precio).toBe(0);

    const tipos = estado.messages.map((m: any) => m._getType?.());
    expect(tipos).not.toContain('tool');
  }, 60000);

  // ---------------------------------------------------------------------------
  // Test 4: dos sesiones en paralelo — ciclos distintos, sin interferencia
  // ---------------------------------------------------------------------------

  it('dos sesiones en paralelo usan ciclos distintos sin interferirse', async () => {
    calls.stock = 0;
    calls.precio = 0;

    const graph = buildGraph();

    const [estadoA, estadoB]: any[] = await Promise.all([
      graph.invoke(
        { messages: [new HumanMessage('¿Cuántas impresoras HP quedan en stock?')] },
        { configurable: { thread_id: 'complejo-paralelo-A' } },
      ),
      graph.invoke(
        { messages: [new HumanMessage('¿Cuál es el precio del teclado mecánico?')] },
        { configurable: { thread_id: 'complejo-paralelo-B' } },
      ),
    ]);

    console.log('sesión A — categoria:', estadoA.categoria, '| calls.stock:', calls.stock);
    console.log('sesión B — categoria:', estadoB.categoria, '| calls.precio:', calls.precio);

    expect(estadoA.categoria).toBe('stock');
    expect(estadoB.categoria).toBe('precio');

    // Cada ciclo llamó a su propia tool
    expect(calls.stock).toBeGreaterThanOrEqual(1);
    expect(calls.precio).toBeGreaterThanOrEqual(1);

    // Los estados son independientes
    expect(estadoA.escalated).toBe(false);
    expect(estadoB.escalated).toBe(false);
  }, 60000);

  // ---------------------------------------------------------------------------
  // Test 5: multi-turno — la sesión cambia de rama entre mensajes
  // ---------------------------------------------------------------------------

  it('multi-turno — primera consulta de stock, segunda de precio, tercera escalacion', async () => {
    const graph = buildGraph();
    const config = { configurable: { thread_id: 'complejo-multiturno' } };

    const e1: any = await graph.invoke(
      { messages: [new HumanMessage('¿Cuántas sillas ergonómicas tienen?')] },
      config,
    );
    console.log('turno 1 — categoria:', e1.categoria);
    expect(e1.categoria).toBe('stock');
    expect(String(e1.messages.at(-1)?.content)).toContain('99');

    const e2: any = await graph.invoke(
      { messages: [new HumanMessage('¿Y cuánto cuesta ese mismo modelo?')] },
      config,
    );
    console.log('turno 2 — categoria:', e2.categoria);
    expect(e2.categoria).toBe('precio');
    expect(String(e2.messages.at(-1)?.content)).toContain('1500');

    const e3: any = await graph.invoke(
      { messages: [new HumanMessage('Necesito hacer una queja, quiero hablar con alguien')] },
      config,
    );
    console.log('turno 3 — categoria:', e3.categoria, '| escalated:', e3.escalated);
    expect(e3.categoria).toBe('escalacion');
    expect(e3.escalated).toBe(true);
  }, 120000);
});
