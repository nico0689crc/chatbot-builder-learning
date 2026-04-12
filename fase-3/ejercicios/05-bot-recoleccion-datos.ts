/**
 * Ejercicio 05 — Bot con Recolección de Datos
 *
 * Objetivo: bot que detecta cuándo le falta información (el ID de pedido)
 * y pregunta antes de ejecutar una tool. Usa structured output para clasificar
 * la intención en un nodo separado.
 *
 * Para correr:
 *   npx ts-node --esm 05-bot-recoleccion-datos.ts
 *
 * Prerequisito: DATABASE_URL en .env
 */

import "dotenv/config";
import { StateGraph, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Estado extendido
//
// A diferencia del ejercicio anterior, el estado ahora guarda la intención
// detectada y el pedidoId extraído (o null si todavía no se conoce).
// ---------------------------------------------------------------------------

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  intencion: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  pedidoId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

type State = typeof GraphState.State;

// ---------------------------------------------------------------------------
// Schema para structured output del nodo clasificar
//
// El modelo debe responder SIEMPRE con esta estructura exacta.
// ---------------------------------------------------------------------------

const ClasificacionSchema = z.object({
  intencion: z
    .enum(["consulta_pedido", "devolucion", "escalar", "faq"])
    .describe("Intención principal del usuario"),
  pedidoId: z
    .string()
    .nullable()
    .describe("ID del pedido mencionado (ej: P-9981), o null si no se mencionó"),
  razon: z.string().describe("Breve explicación de por qué clasificaste así"),
});

// ---------------------------------------------------------------------------
// Tools (las mismas del ejercicio anterior)
// ---------------------------------------------------------------------------

const pedidos = [
  { id: "P-9981", estado: "en_camino", estimadoEntrega: "2026-05-01" },
  { id: "P-7742", estado: "entregado", estimadoEntrega: "2026-04-10" },
  { id: "P-1234", estado: "retrasado", estimadoEntrega: "2026-05-15" },
];

const obtenerPedido = tool(
  async ({ pedidoId }) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    return pedido ?? { error: "Pedido no encontrado" };
  },
  {
    name: "obtener_pedido",
    description: "Consulta el estado de un pedido por su ID",
    schema: z.object({ pedidoId: z.string() }),
  }
);

const iniciarDevolucion = tool(
  async ({ pedidoId, motivo }) => ({
    casoId: `C-${Date.now()}`,
    estado: "iniciada",
    instrucciones: "Empaquetá el producto y llevalo a cualquier sucursal.",
    pedidoId,
    motivo,
  }),
  {
    name: "iniciar_devolucion",
    description: "Inicia el proceso de devolución de un pedido",
    schema: z.object({
      pedidoId: z.string(),
      motivo: z.string(),
    }),
  }
);

const escalarAHumano = tool(
  async ({ motivo }) => ({
    ticketId: `T-${Date.now()}`,
    tiempoEspera: "5-10 minutos",
    mensaje: "Un agente se va a comunicar con vos pronto.",
    motivo,
  }),
  {
    name: "escalar_a_humano",
    description: "Escala la conversación a un agente humano",
    schema: z.object({ motivo: z.string() }),
  }
);

const tools = [obtenerPedido, iniciarDevolucion, escalarAHumano];

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

// Para clasificar: responde con estructura fija (no usa tools)
const modelClasificador = model.withStructuredOutput(ClasificacionSchema);

// Para ejecutar: puede llamar tools
const modelConTools = model.bindTools(tools);

// ---------------------------------------------------------------------------
// Nodo 1 — clasificar
//
// Usa structured output para detectar la intención y extraer el pedidoId.
// Guarda ambos en el estado.
// ---------------------------------------------------------------------------

async function clasificar(state: State): Promise<Partial<State>> {
  // TODO: invocar modelClasificador con un system prompt + los mensajes actuales
  // El system prompt debe explicarle al modelo qué tipos de intención existen
  // y que extraiga el pedidoId si aparece en el mensaje (formato P-XXXX)
  //
  // Retornar: { intencion, pedidoId, messages: [] }
  // (messages vacío porque este nodo no agrega mensajes al historial)
  const response = await modelClasificador.invoke([
    new SystemMessage({
      content: "Sos un bot de clasificación de intenciones. Clasifica la intención del usuario y extrae el pedidoId si aparece en el mensaje (formato P-XXXX)."
    }),
    ...state.messages
  ]);
  return { intencion: response.intencion, pedidoId: response.pedidoId, messages: [] };
}

// ---------------------------------------------------------------------------
// Nodo 2 — pedirPedidoId
//
// Se ejecuta cuando la intención requiere un pedidoId pero el usuario no lo dio.
// Responde con una pregunta y termina el turno (espera el próximo mensaje).
// ---------------------------------------------------------------------------

async function pedirPedidoId(state: State): Promise<Partial<State>> {
  // TODO: retornar un AIMessage preguntando por el número de pedido
  // Podés personalizar el mensaje según state.intencion
  // Ej: "Para iniciar la devolución necesito el número de pedido (formato P-XXXX)."
  return {
    messages: [
      new AIMessage({
        content: `Para ${state.intencion} necesito el número de pedido (formato P-XXXX).`
      })
    ]
  };
}

// ---------------------------------------------------------------------------
// Nodo 3 — ejecutar
//
// Se ejecuta cuando ya tenemos la intención y el pedidoId.
// Llama al modelo con tools para que resuelva.
// ---------------------------------------------------------------------------

async function ejecutar(state: State): Promise<Partial<State>> {
  // TODO: invocar modelConTools con un system prompt + state.messages
  // El system prompt debe incluir que ya se sabe el pedidoId (state.pedidoId)
  // y la intención (state.intencion) para que el modelo actúe directamente
  const response = await modelConTools.invoke([
    new SystemMessage({
      content: `Ya sabemos que la intención es ${state.intencion} y el pedidoId es ${state.pedidoId}. Ahora el modelo puede actuar directamente.`
    }),
    ...state.messages
  ]);
  return {
    messages: [response],
  };
}

// ---------------------------------------------------------------------------
// Nodo 4 — responderFaq
//
// Para preguntas que no requieren tools (horarios, políticas, etc.)
// ---------------------------------------------------------------------------

async function responderFaq(state: State): Promise<Partial<State>> {
  // TODO: invocar model (sin tools) con un system prompt que incluya
  // la información de FAQ relevante: horarios, políticas, contacto
  const response = await model.invoke([
    new SystemMessage({
      content: "Sos un bot de FAQ. Responde preguntas generales sobre horarios, políticas y contacto."
    }),
    ...state.messages
  ]);

  return { messages: [response] };
}

// ---------------------------------------------------------------------------
// Aristas condicionales
// ---------------------------------------------------------------------------

// Después de clasificar: decide a qué nodo ir según intención + pedidoId
function routeAfterClasificar(state: State): "pedirPedidoId" | "ejecutar" | "responderFaq" {
  if (state.intencion === "faq") return "responderFaq";
  if (state.pedidoId === null) return "pedirPedidoId";
  return "ejecutar";
}

// Después de ejecutar: si el modelo llamó tools → "tools", si no → END
function routeAfterEjecutar(state: State): "tools" | "__end__" {
  // TODO: mismo patrón que routeAfterModel del ejercicio anterior
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  } else {
    return "__end__";
  }
}

// ---------------------------------------------------------------------------
// Checkpointer y grafo
// ---------------------------------------------------------------------------

const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
const toolNode = new ToolNode(tools);

const graph = new StateGraph(GraphState)
  .addNode("clasificar", clasificar)
  .addNode("pedirPedidoId", pedirPedidoId)
  .addNode("ejecutar", ejecutar)
  .addNode("responderFaq", responderFaq)
  .addNode("tools", toolNode)
  .addEdge("__start__", "clasificar")
  .addConditionalEdges("clasificar", routeAfterClasificar, {
    "responderFaq": "responderFaq",
    "pedirPedidoId": "pedirPedidoId",
    "ejecutar": "ejecutar",
  })
  .addConditionalEdges("ejecutar", routeAfterEjecutar, {
    "tools": "tools",
    "__end__": "__end__",
  })
  .addEdge("tools", "ejecutar")
  .addEdge("pedirPedidoId", "__end__")
  .addEdge("responderFaq", "__end__")
  .compile({ checkpointer });

// ---------------------------------------------------------------------------
// Casos de prueba
//
// El desafío: caso-3 es multi-turno. El bot debe pedir el ID en el primer
// mensaje y procesarlo en el segundo.
// ---------------------------------------------------------------------------

async function main() {
  await checkpointer.setup();

  console.log("=== Casos de un solo turno ===\n");

  const casosSingleTurn = [
    { thread: "t-1", mensaje: "Mi pedido P-9981 no llegó" },
    { thread: "t-2", mensaje: "¿Cuál es el horario de atención?" },
    { thread: "t-3", mensaje: "Quiero hablar con un humano, esto es urgente" },
    { thread: "t-4", mensaje: "Quiero devolver el pedido P-7742" },
  ];

  for (const { thread, mensaje } of casosSingleTurn) {
    const config = { configurable: { thread_id: thread } };
    const result = await graph.invoke(
      { messages: [new HumanMessage(mensaje)] },
      config
    );
    const last = result.messages[result.messages.length - 1];
    console.log(`Usuario: "${mensaje}"`);
    console.log(`Bot:     "${last.content}"`);
    console.log("---");
  }

  console.log("\n=== Caso multi-turno (sin ID → bot pregunta → usuario responde) ===\n");

  const config = { configurable: { thread_id: "t-multi" } };

  // Turno 1: el usuario no da el ID
  const turno1 = await graph.invoke(
    { messages: [new HumanMessage("Quiero hacer una devolución")] },
    config
  );
  const respuesta1 = turno1.messages[turno1.messages.length - 1];
  console.log(`Usuario: "Quiero hacer una devolución"`);
  console.log(`Bot:     "${respuesta1.content}"`);
  console.log("---");

  // Turno 2: el usuario da el ID
  const turno2 = await graph.invoke(
    { messages: [new HumanMessage("El pedido es P-1234")] },
    config
  );
  const respuesta2 = turno2.messages[turno2.messages.length - 1];
  console.log(`Usuario: "El pedido es P-1234"`);
  console.log(`Bot:     "${respuesta2.content}"`);
  console.log("---");
}

main().catch(console.error);
