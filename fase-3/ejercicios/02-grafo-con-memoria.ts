import { StateGraph, END } from "@langchain/langgraph";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

// 1. Estado — usamos MessagesAnnotation para acumular mensajes
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userName: Annotation<string>(),
});

type State = typeof GraphState.State;

// 2. Nodo: responder
async function respond(state: State): Promise<Partial<State>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const input = (lastMessage as HumanMessage).content as string;

  // TODO: si userName no está seteado y el input contiene "me llamo"
  //       extraer el nombre y guardarlo en userName
  //       responder "Hola [nombre], ¿en qué te puedo ayudar?"
  //
  //       si userName ya está seteado
  //       responder "Hola de nuevo [userName], recibí tu mensaje: [input]"
  //
  //       si no aplica ninguno
  //       responder "No sé tu nombre aún. ¿Cómo te llamás?"
  let responseText = "";
  if (!state.userName && input.toLowerCase().includes("me llamo")) {
    const nameMatch = input.match(/me llamo\s+(\w+)/i);
    if (nameMatch) {
      const name = nameMatch[1];
      responseText = `Hola ${name}, ¿en qué te puedo ayudar?`;
      return {
        messages: [new AIMessage(responseText)],
        userName: name,
      };
    }
  } else if (state.userName) {
    responseText = `Hola de nuevo ${state.userName}, recibí tu mensaje: ${input}`;
  } else {
    responseText = "No sé tu nombre aún. ¿Cómo te llamás?";
  }

  return {
    messages: [new AIMessage(responseText)],
  };
}

// 3. Grafo con checkpointer
const memory = new MemorySaver();

const graph = new StateGraph(GraphState)
  .addNode("respond", respond)
  .addEdge("__start__", "respond")
  .addEdge("respond", END)
  .compile({ checkpointer: memory }); // <- así se conecta el checkpointer

// 4. Simulación de conversación
async function main() {
  const config = { configurable: { thread_id: "conversacion-1" } };

  const mensajes = [
    "Hola",
    "Me llamo Nicolas",
    "¿Cuánto cuesta el plan?",
  ];

  for (const input of mensajes) {
    const result = await graph.invoke(
      { messages: [new HumanMessage(input)] },
      config // <- el thread_id hace que el grafo recuerde
    );

    const last = result.messages[result.messages.length - 1];
    console.log(`Usuario: "${input}"`);
    console.log(`Bot:     "${last.content}"`);
    console.log("---");
  }
}

main();
