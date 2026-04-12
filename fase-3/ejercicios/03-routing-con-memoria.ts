import { StateGraph, END } from "@langchain/langgraph";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userName: Annotation<string>(),
  category: Annotation<string>(),
});

type State = typeof GraphState.State;

// TODO: nodo classify
// - Si no hay userName y el input contiene "me llamo" → category = "greeting"
// - Si el input contiene "problema", "error", "falla" → category = "complaint"
// - Si el input contiene "hablar con alguien" → category = "escalation"
// - Si no → category = "question"
async function classify(state: State): Promise<Partial<State>> {
  const input = state.messages[state.messages.length - 1].content as string;
  if (!state.userName && input.toLowerCase().includes("me llamo")) {
    return { category: "greeting" };
  }
  if (input.toLowerCase().includes("problema") || input.toLowerCase().includes("error") || input.toLowerCase().includes("falla")) {
    return { category: "complaint" };
  }
  if (input.includes("hablar con alguien")) {
    return { category: "escalation" };
  }
  return { category: "question" };
}

// TODO: nodo handleGreeting
// - Extraer el nombre del input
// - Guardar userName en el estado
// - Responder "Hola [nombre], ¿en qué te puedo ayudar?"
async function handleGreeting(state: State): Promise<Partial<State>> {
  const input = state.messages[state.messages.length - 1].content as string;
  const userName = input.toLowerCase().split("me llamo")[1].trim();
  return {
    userName,
    messages: [new AIMessage(`Hola ${userName}, ¿en qué te puedo ayudar?`)]
  };
}

// TODO: nodo handleComplaint
// - Si hay userName, personalizar la respuesta con el nombre
// - Si no hay userName, respuesta genérica
async function handleComplaint(state: State): Promise<Partial<State>> {
  return state.userName ? {
    messages: [new AIMessage(`Hola ${state.userName}, lamento que tengas un problema.`)]
  } : {
    messages: [new AIMessage("Lamento que tengas un problema.")]
  };
}

// TODO: nodo handleEscalation
async function handleEscalation(state: State): Promise<Partial<State>> {
  return state.userName ? {
    messages: [new AIMessage(`Hola ${state.userName}, te transferiremos con un agente.`)]
  } : {
    messages: [new AIMessage("Te transferiremos con un agente.")]
  };
}

// TODO: nodo handleQuestion
// - Si hay userName, usar el nombre en la respuesta
async function handleQuestion(state: State): Promise<Partial<State>> {
  return state.userName ? {
    messages: [new AIMessage(`Hola ${state.userName}, ¿en qué puedo ayudarte?`)]
  } : {
    messages: [new AIMessage("¿En qué puedo ayudarte?")]
  };
}

const memory = new MemorySaver();

const graph = new StateGraph(GraphState)
  // TODO: registrar nodos, aristas fijas y condicionales
  .addNode("classify", classify)
  .addNode("handleGreeting", handleGreeting)
  .addNode("handleComplaint", handleComplaint)
  .addNode("handleEscalation", handleEscalation)
  .addNode("handleQuestion", handleQuestion)
  .addEdge("__start__", "classify")
  .addConditionalEdges("classify", (state) => state.category, {
    greeting: "handleGreeting",
    complaint: "handleComplaint",
    escalation: "handleEscalation",
    question: "handleQuestion",
  })
  .addEdge("handleGreeting", END)
  .addEdge("handleComplaint", END)
  .addEdge("handleEscalation", END)
  .addEdge("handleQuestion", END)
  .compile({ checkpointer: memory });

async function main() {
  const config = { configurable: { thread_id: "conv-1" } };

  const mensajes = [
    "Hola",
    "Me llamo Nicolas",
    "Tengo un problema con el acceso",
    "Quiero hablar con alguien",
    "¿Cuánto cuesta el plan pro?",
  ];

  for (const input of mensajes) {
    const result = await graph.invoke(
      { messages: [new HumanMessage(input)] },
      config
    );
    const beforeLast = result.messages[result.messages.length - 2];
    const last = result.messages[result.messages.length - 1];
    console.log(`Usuario: "${beforeLast.content}"`);
    console.log(`Bot:     "${last.content}"`);
    console.log("---");
  }
}

main();
