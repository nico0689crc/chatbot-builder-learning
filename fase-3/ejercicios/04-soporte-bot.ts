/**
 * Sesión 8 — Bot de Soporte Completo
 *
 * Objetivo: bot que detecta cuándo usar tools, cuándo responder directo,
 * y cuándo escalar — con estado persistido en PostgreSQL.
 *
 * Para correr:
 *   npx ts-node 04-soporte-bot.ts
 *
 * Prerequisito:
 *   npm install @langchain/langgraph-checkpoint-postgres pg
 *   DATABASE_URL en tu .env (la misma que usa Prisma)
 */

import "dotenv/config";
import { StateGraph, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { z } from "zod";

type Pedido = {
  id: string;
  estado: string;
  estimadoEntrega: string;
};

type CasoDevolucion = {
  casoId: string;
  estado: string;
  instrucciones: string;
  pedidoId: string;
  motivo: string;
};

type TicketSoporte = {
  ticketId: string;
  tiempoEspera: string;
  mensaje: string;
  razon: string;
  pedidoId: string;
};

const pedidos: Pedido[] = [
  { id: "P-9981", estado: "en_camino", estimadoEntrega: "2022-01-01" },
  { id: "P-7742", estado: "entregado", estimadoEntrega: "2022-01-01" },
  { id: "P-1234", estado: "retrasado", estimadoEntrega: "2022-01-01" },
  { id: "P-5678", estado: "cancelado", estimadoEntrega: "2022-01-01" },
];

// ---------------------------------------------------------------------------
// Estado del grafo
// ---------------------------------------------------------------------------

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

type State = typeof GraphState.State;

// ---------------------------------------------------------------------------
// Ejercicio 8.3 — Tools de soporte
//
// Implementá el cuerpo de cada tool. Por ahora usá datos simulados.
// En producción consultarían la base de datos.
// ---------------------------------------------------------------------------

const obtenerPedido = tool(
  async ({ pedidoId }) => {
    // TODO: retornar un objeto JSON con: id, estado, estimadoEntrega
    // Ejemplo de estados posibles: "en_camino", "entregado", "retrasado", "cancelado"
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) {
      return { error: "Pedido no encontrado" };
    }
    return pedido;
  },
  {
    name: "obtener_pedido",
    description: "Consulta el estado actual de un pedido por su ID",
    schema: z.object({
      pedidoId: z.string().describe("ID del pedido a consultar"),
    }),
  }
);

const iniciarDevolucion = tool(
  async ({ pedidoId, motivo }) => {
    // TODO: retornar un objeto JSON con: casoId, estado, instrucciones
    return {
      casoId: "C-1234",
      estado: "pendiente",
      instrucciones: "Por favor, empaqueta el producto y envíalo a la dirección proporcionada.",
    };
  },
  {
    name: "iniciar_devolucion",
    description: "Inicia el proceso de devolución de un pedido",
    schema: z.object({
      pedidoId: z.string().describe("ID del pedido a devolver"),
      motivo: z.string().describe("Motivo de la devolución"),
    }),
  }
);

const escalarAHumano = tool(
  async ({ motivo }) => {
    // TODO: retornar un objeto JSON con: ticketId, tiempoEspera, mensaje
    return {
      ticketId: "T-1234",
      tiempoEspera: "5 minutos",
      mensaje: motivo,
    };
  },
  {
    name: "escalar_a_humano",
    description: "Escala la conversación a un agente humano cuando el bot no puede resolver",
    schema: z.object({
      motivo: z.string().describe("Razón por la que se escala a un humano"),
    }),
  }
);

const tools = [obtenerPedido, iniciarDevolucion, escalarAHumano];

// ---------------------------------------------------------------------------
// Ejercicio 8.2 — Nodo que llama al modelo con tools bindeadas
//
// El modelo decide si usar una tool o responder directo.
// ---------------------------------------------------------------------------

const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" }).bindTools(tools);

async function callModel(state: State): Promise<Partial<State>> {
  // TODO: invocar modelConTools con state.messages
  // Hint: pasale un system prompt que explique que es un bot de soporte
  // y que use las tools cuando corresponda
  const response = await model.invoke([
    new SystemMessage({ content: "Sos un bot de soporte. Usa las tools cuando corresponda." }),
    ...state.messages
  ]);

  return { messages: [response] };
}

// ---------------------------------------------------------------------------
// Arista condicional post-modelo
//
// Si el modelo generó tool_calls → ejecutar tools
// Si no → terminar
// ---------------------------------------------------------------------------

function routeAfterModel(state: State): "tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return "__end__";
}

// ---------------------------------------------------------------------------
// Ejercicio 8.1 — Checkpointer con PostgreSQL
//
// Reemplaza el MemorySaver de los ejercicios anteriores.
// ---------------------------------------------------------------------------

// TODO: crear el checkpointer usando PostgresSaver.fromConnString()
// y llamar a checkpointer.setup() antes de compilar el grafo
const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);

// ---------------------------------------------------------------------------
// Grafo
//
// Ejercicio 8.4 — Conectar el ToolNode y las aristas condicionales
// ---------------------------------------------------------------------------

const toolNode = new ToolNode(tools);

const graph = new StateGraph(GraphState)
  .addNode("model", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "model")
  // TODO: addConditionalEdges desde "model" usando routeAfterModel
  // TODO: addEdge desde "tools" → "model" (loop hasta que el modelo termine)
  .addConditionalEdges("model", routeAfterModel, {
    tools: "tools",
    __end__: END,
  })
  .addEdge("tools", "model")
  .compile({ checkpointer });

// ---------------------------------------------------------------------------
// Casos de prueba obligatorios (Sesión 8)
// ---------------------------------------------------------------------------

async function main() {
  // TODO: llamar a checkpointer.setup() antes de invocar el grafo
  await checkpointer.setup();

  const casos = [
    { thread: "caso-1", mensaje: "Mi pedido no llegó, el número es P-9981" },
    { thread: "caso-2", mensaje: "¿Cuál es el horario de atención?" },
    { thread: "caso-3", mensaje: "Quiero hablar con alguien, esto es urgente" },
    { thread: "caso-4", mensaje: "Quiero hacer una devolución del pedido P-7742" },
  ];

  for (const { thread, mensaje } of casos) {
    const config = { configurable: { thread_id: thread } };

    const result = await graph.invoke(
      { messages: [new HumanMessage(mensaje)] },
      config
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log(`\nUsuario: "${mensaje}"`);
    console.log(`Bot:     "${lastMessage.content}"`);
    console.log("---");
  }
}

main().catch(console.error);
