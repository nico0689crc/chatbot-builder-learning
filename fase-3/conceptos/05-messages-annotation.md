# MessagesAnnotation y Historial de Conversación

## El problema con `Annotation<string>()`

En el primer grafo el estado tenía `input: Annotation<string>()` — un solo mensaje. Para un chatbot necesitás acumular toda la conversación, no solo el último mensaje.

Si usaras un string simple:
```typescript
// ❌ Cada nodo sobreescribe el mensaje anterior
return { input: "nuevo mensaje" }; // el anterior se pierde
```

## MessagesAnnotation

`MessagesAnnotation` es un estado predefinido de LangGraph con un reducer que **acumula** mensajes en lugar de sobreescribirlos:

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Usarlo solo:
const graph = new StateGraph(MessagesAnnotation)

// O hacer spread para combinarlo con tus propias claves:
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userName: Annotation<string>(),
  category: Annotation<string>(),
});
```

## Tipos de mensajes

LangGraph usa los tipos de mensajes de LangChain:

```typescript
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

new HumanMessage("texto")   // mensaje del usuario
new AIMessage("texto")      // respuesta del bot
new SystemMessage("texto")  // instrucción al sistema (no visible al usuario)
```

Todos extienden `BaseMessage` y tienen `.content` y `._getType()`.

## Cómo funciona el reducer

Cuando un nodo devuelve `{ messages: [new AIMessage("Hola")] }`, el reducer hace:

```typescript
// estado actual:
messages: [HumanMessage("Hola")]

// nodo devuelve:
{ messages: [AIMessage("¡Hola! ¿En qué te ayudo?")] }

// estado resultante:
messages: [HumanMessage("Hola"), AIMessage("¡Hola! ¿En qué te ayudo?")]
```

El array crece con cada turno. Con checkpointer, este array persiste entre invocaciones.

## Leer el último mensaje en un nodo

```typescript
async function respond(state: State): Promise<Partial<State>> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const input = (lastMessage as HumanMessage).content as string;

  // procesar input...

  return {
    messages: [new AIMessage("Mi respuesta")],
  };
}
```

## Pasar el historial a un LLM

Cuando integrés el LLM (Sesión 8), podés pasar el historial completo directamente:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

async function respond(state: State): Promise<Partial<State>> {
  const llm = new ChatAnthropic({ model: "claude-sonnet-4-6" });

  // state.messages contiene toda la conversación acumulada
  const response = await llm.invoke([
    new SystemMessage("Sos un asistente de soporte."),
    ...state.messages, // historial completo
  ]);

  return { messages: [response] }; // response ya es un AIMessage
}
```

El LLM recibe todo el contexto anterior y puede responder coherentemente.

## Iterar el historial

```typescript
const result = await graph.invoke({ messages: [new HumanMessage("...")] }, config);

result.messages.forEach(msg => {
  const role = msg._getType() === "human" ? "Usuario" : "Bot";
  console.log(`${role}: ${msg.content}`);
});
```

## Comparación: con y sin MessagesAnnotation

```typescript
// Sin MessagesAnnotation — estado plano
const GraphState = Annotation.Root({
  input: Annotation<string>(),    // solo el mensaje actual
  response: Annotation<string>(), // solo la última respuesta
});
// → no hay historial, no funciona bien con checkpointers

// Con MessagesAnnotation — historial acumulado
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,     // messages: BaseMessage[] con reducer
  userName: Annotation<string>(), // datos extra de la conversación
});
// → historial completo, funciona perfecto con checkpointers
```

Usá `MessagesAnnotation` siempre que el grafo sea un chatbot. Usá estado plano solo para grafos de procesamiento que no son conversacionales.
