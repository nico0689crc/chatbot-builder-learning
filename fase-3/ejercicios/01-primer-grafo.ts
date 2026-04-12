import { StateGraph, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// 1. Estado
const GraphState = Annotation.Root({
  input: Annotation<string>(),
  category: Annotation<string>(),
  response: Annotation<string>(),
});

type State = typeof GraphState.State;

// 2. Nodo: clasificar
async function classify(state: State): Promise<Partial<State>> {
  // TODO: si el input contiene "error", "problema" o "falla" → category = "complaint"
  //       si no → category = "question"
  if (
    state.input.toLowerCase().includes("error") ||
    state.input.toLowerCase().includes("problema") ||
    state.input.toLowerCase().includes("falla")
  ) {
    return { category: "complaint" };
  } else if (state.input.toLowerCase().includes("hablar con alguien")) {
    return { category: "escalation" };
  } else {
    return { category: "question" };
  }
}

// 3. Nodo: responder preguntas
async function handleQuestion(state: State): Promise<Partial<State>> {
  // TODO: devolver una respuesta genérica para preguntas
  const response = "Gracias por tu pregunta. Te responderemos a la brevedad.";
  return { response };
}

// 4. Nodo: responder quejas
async function handleComplaint(state: State): Promise<Partial<State>> {
  // TODO: devolver una respuesta empática para quejas
  const response = "Lamentamos que estés teniendo problemas. Te ayudaremos a resolverlo.";
  return { response };
}

async function handleEscalation(state: State): Promise<Partial<State>> {
  const response = "Vamos a escalar tu caso a un agente humano.";
  return { response };
}

// 5. Función de routing
function router(state: State): string {
  // TODO: retornar "handleQuestion" o "handleComplaint" según state.category
  if (state.category === "complaint") {
    return "handleComplaint";
  } else if (state.category === "escalation") {
    return "handleEscalation";
  } else {
    return "handleQuestion";
  }
}

// 6. Grafo
const graph = new StateGraph(GraphState)
  .addNode("classify", classify)
  .addNode("handleQuestion", handleQuestion)
  .addNode("handleComplaint", handleComplaint)
  .addNode("handleEscalation", handleEscalation)
  .addEdge("__start__", "classify")
  // TODO: agregar addConditionalEdges desde "classify" usando router
  .addConditionalEdges("classify", router)
  .addEdge("handleQuestion", END)
  .addEdge("handleComplaint", END)
  .addEdge("handleEscalation", END)
  .compile();

// 7. Prueba
async function main() {
  const inputs = [
    "Tengo un problema con mi factura",
    "¿Cuánto cuesta el plan premium?",
    "Quiero hablar con alguien",
  ];

  for (const input of inputs) {
    const result = await graph.invoke({ input });
    console.log(`Input:    "${input}"`);
    console.log(`Category: ${result.category}`);
    console.log(`Response: ${result.response}`);
    console.log("---");
  }
}

main();