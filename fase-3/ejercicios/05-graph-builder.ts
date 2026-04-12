// fase-3/ejercicios/05-graph-builder.ts

import "dotenv/config";
import { StateGraph, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

// ---------------------------------------------------------------------------
// Estado compartido (igual para todos los arquetipos por ahora)
// ---------------------------------------------------------------------------

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

type State = typeof GraphState.State;
type Arquetipo = "faq" | "soporte";
type Pedido = {
  id: string;
  estado: string;
  estimadoEntrega: string;
};

// ---------------------------------------------------------------------------
// Ejercicio 9.2 — construirGrafoFAQ
//
// Grafo simple: solo un nodo "model" que responde preguntas frecuentes.
// Sin tools. Sin escalado. El modelo recibe un system prompt de FAQ.
// ---------------------------------------------------------------------------

function construirGrafoFAQ(checkpointer: PostgresSaver) {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

  async function callModel(state: State): Promise<Partial<State>> {
    // TODO: invocar model con system prompt de FAQ + state.messages
    const result = await model.invoke([
      new SystemMessage("Sos un asistente de FAQ. Responde de forma breve y concisa."),
      ...state.messages
    ]);
    return { messages: [result] };
  }

  return new StateGraph(GraphState)
    .addNode("model", callModel)
    .addEdge("__start__", "model")
    .addEdge("model", "__end__")
    .compile({ checkpointer });
}

// ---------------------------------------------------------------------------
// Ejercicio 9.3 — construirGrafoSoporte
//
// Reutilizá la lógica de 04-soporte-bot.ts pero empaquetada como función.
// Tools: obtenerPedido, iniciarDevolucion, escalarAHumano
// ---------------------------------------------------------------------------

function construirGrafoSoporte(checkpointer: PostgresSaver) {
  const pedidos: Pedido[] = [
    { id: "P-9981", estado: "en_camino", estimadoEntrega: "2022-01-01" },
    { id: "P-7742", estado: "entregado", estimadoEntrega: "2022-01-01" },
    { id: "P-1234", estado: "retrasado", estimadoEntrega: "2022-01-01" },
    { id: "P-5678", estado: "cancelado", estimadoEntrega: "2022-01-01" },
  ];

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
  // Grafo
  //
  // Ejercicio 8.4 — Conectar el ToolNode y las aristas condicionales
  // ---------------------------------------------------------------------------

  const toolNode = new ToolNode(tools);

  return new StateGraph(GraphState)
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
}

// ---------------------------------------------------------------------------
// Ejercicio 9.1 — Graph Builder principal
//
// Recibe un arquetipo y devuelve el grafo compilado listo para invocar.
// ---------------------------------------------------------------------------

export function buildGraph(arquetipo: Arquetipo, checkpointer: PostgresSaver) {
  switch (arquetipo) {
    case "faq":
      return construirGrafoFAQ(checkpointer);
    case "soporte":
      return construirGrafoSoporte(checkpointer);
    default:
      throw new Error(`Arquetipo desconocido: ${arquetipo}`);
  }
}

// ---------------------------------------------------------------------------
// Ejercicio 9.4 — Simulación del endpoint /chat
//
// En vez de un Express real, simulamos dos "tenants" con arquetipos distintos.
// ---------------------------------------------------------------------------

async function main() {
  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  await checkpointer.setup();

  // Tenant A: cliente FAQ
  const tenantA = { id: "tenant-faq", arquetipo: "faq" as Arquetipo };
  // Tenant B: cliente Soporte
  const tenantB = { id: "tenant-soporte", arquetipo: "soporte" as Arquetipo };

  const casos = [
    { tenant: tenantA, mensaje: "¿Cuáles son los horarios de atención?" },
    { tenant: tenantB, mensaje: "Mi pedido P-9981 no llegó" },
    { tenant: tenantA, mensaje: "¿Cómo puedo pagar?" },
    { tenant: tenantB, mensaje: "Quiero hablar con alguien" },
  ];

  for (const { tenant, mensaje } of casos) {
    const grafo = buildGraph(tenant.arquetipo, checkpointer);
    const config = { configurable: { thread_id: `${tenant.id}-${Date.now()}` } };

    const result = await grafo.invoke(
      { messages: [new HumanMessage(mensaje)] },
      config
    );

    const last = result.messages[result.messages.length - 1];
    console.log(`\n[${tenant.arquetipo.toUpperCase()}] Usuario: "${mensaje}"`);
    console.log(`[${tenant.arquetipo.toUpperCase()}] Bot:     "${last.content}"`);
    console.log("---");
  }
}

main().catch(console.error);
