import "dotenv/config";
import { StateGraph, END, MessagesAnnotation, Annotation, interrupt, Command } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  aprobacionOperador: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
});
type State = typeof GraphState.State;

// ---------------------------------------------------------------------------
// Ejercicio 10.1 — Nodo que interrumpe el grafo para pedir aprobación
//
// interrupt() pausa el grafo y devuelve el valor al caller.
// El grafo puede reanudarse pasando new Command({ resume: valor })
// ---------------------------------------------------------------------------

async function confirmarEscalado(state: State): Promise<Partial<State>> {
  // interrupt() pausa el grafo y devuelve lo que el operador envíe al reanudar
  const respuesta = interrupt("¿Confirmás el escalado a un humano? (si/no)");
  return { aprobacionOperador: respuesta };
}

async function escalarAHumano(state: State): Promise<Partial<State>> {
  // TODO: retornar un objeto JSON con: ticketId, tiempoEspera, mensaje
  return {
    messages: [new AIMessage({ content: "Escalado a humano exitoso" })],
  };
}

// ---------------------------------------------------------------------------
// Ejercicio 10.2 — Routing post-confirmación
//
// Si el operador aprobó → ejecutar escalarAHumano
// Si rechazó → terminar con mensaje al usuario
// ---------------------------------------------------------------------------

function routeAfterConfirmacion(state: State): "escalar" | "__end__" {
  if (state.aprobacionOperador?.toLowerCase() === "si") {
    return "escalar";
  }
  return "__end__";
}

// ... tools, model, callModel igual que sesión 9 ...


// ---------------------------------------------------------------------------
// Ejercicio 10.3/10.4 — main con flujo de pausa y reanudación
// ---------------------------------------------------------------------------

async function main() {
  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  await checkpointer.setup();

  const config = { configurable: { thread_id: "hitl-test-1" } };

  const graph = new StateGraph(GraphState)
    .addNode("confirmar_escalado", confirmarEscalado)
    .addNode("escalar_a_humano", escalarAHumano)
    .addEdge("__start__", "confirmar_escalado")
    .addConditionalEdges("confirmar_escalado", routeAfterConfirmacion, {
      escalar: "escalar_a_humano",
      "__end__": END,
    })
    .compile({ checkpointer });

  // Paso 1: usuario pide escalar → grafo se pausa
  const resultado1 = await graph.invoke(
    { messages: [new HumanMessage("Quiero hablar con alguien urgente")] },
    config
  );
  console.log("Grafo pausado. Esperando aprobación...");
  console.log(resultado1);

  // Paso 2: operador aprueba → grafo se reanuda
  const resultado2 = await graph.invoke(
    new Command({ resume: "si" }),
    config
  );
  console.log("Escalado ejecutado:");
  console.log(resultado2.messages[resultado2.messages.length - 1].content);
}

main().catch(console.error);
