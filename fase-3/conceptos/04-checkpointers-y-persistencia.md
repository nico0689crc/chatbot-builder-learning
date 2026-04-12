# Checkpointers y Persistencia de Estado

## El problema: grafos sin memoria

Por defecto, cada `graph.invoke()` es stateless. El grafo no recuerda nada entre llamadas:

```typescript
await graph.invoke({ input: "Me llamo Nicolás" });
await graph.invoke({ input: "¿Cuál es mi nombre?" }); // no sabe que es Nicolás
```

Para un chatbot esto es un problema crítico: cada mensaje llegaría sin contexto de los anteriores.

## La solución: Checkpointers

Un checkpointer es un storage que LangGraph usa para guardar el estado después de cada nodo. Cuando llega el próximo mensaje, el grafo restaura el estado desde donde lo dejó.

```
invoke(msg1, { thread_id: "user-123" })
    │
    ├── ejecuta nodos
    └── guarda estado en storage con key "user-123"

invoke(msg2, { thread_id: "user-123" })
    │
    ├── restaura estado de "user-123"
    ├── ejecuta nodos con el estado restaurado
    └── guarda estado actualizado
```

## El thread_id

El `thread_id` identifica una conversación. Es la clave de partición en el storage. En un builder multi-tenant típicamente es:

```
`${chatbotId}:${userId}`
```

Se pasa como parte del config en cada invocación:

```typescript
const config = { configurable: { thread_id: "chatbot-abc:user-123" } };

await graph.invoke({ messages: [new HumanMessage("Hola")] }, config);
await graph.invoke({ messages: [new HumanMessage("¿Y el precio?")] }, config);
// el segundo invoke tiene acceso al historial del primero
```

Dos conversaciones distintas → dos `thread_id` distintos → estados completamente independientes.

## Checkpointers disponibles

### MemorySaver — para desarrollo

Guarda el estado en memoria RAM. Se pierde al reiniciar el proceso.

```typescript
import { MemorySaver } from "@langchain/langgraph";

const memory = new MemorySaver();

const graph = new StateGraph(GraphState)
  .addNode("respond", respond)
  .addEdge("__start__", "respond")
  .addEdge("respond", END)
  .compile({ checkpointer: memory }); // conectar el checkpointer
```

Usalo para: desarrollo local, testing, ejercicios.

### PostgresSaver — para producción

Persiste el estado en PostgreSQL. Sobrevive reinicios y funciona con múltiples instancias del servidor.

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
await checkpointer.setup(); // crea las tablas necesarias

const graph = new StateGraph(GraphState)
  // ...
  .compile({ checkpointer });
```

Usalo para: producción, staging, cualquier ambiente donde el estado debe sobrevivir.

## MessagesAnnotation: el estado para conversaciones

Cuando usás checkpointers con historial de mensajes, conviene usar `MessagesAnnotation` en lugar de un `Annotation<string>` manual. Tiene un reducer que acumula mensajes automáticamente:

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,      // spread: incluye messages: BaseMessage[]
  userName: Annotation<string>(),  // podés agregar tus propias claves
});
```

Cuando un nodo devuelve `{ messages: [new AIMessage("Hola")] }`, el reducer **agrega** ese mensaje al array — no lo reemplaza. El historial completo queda en `state.messages`.

```typescript
async function respond(state: State): Promise<Partial<State>> {
  const lastMessage = state.messages[state.messages.length - 1]; // último mensaje
  const input = (lastMessage as HumanMessage).content as string;

  return {
    messages: [new AIMessage("Mi respuesta")], // se agrega al historial
  };
}
```

## Cómo leer el historial completo

```typescript
const result = await graph.invoke({ messages: [new HumanMessage("...")] }, config);

// todos los mensajes acumulados en la conversación
result.messages.forEach(msg => {
  const role = msg._getType() === "human" ? "Usuario" : "Bot";
  console.log(`${role}: ${msg.content}`);
});
```

## Flujo completo con checkpointer

```
invoke(msg1, { thread_id: "T1" })
    │
    ▼
 respond  ← state.messages = [HumanMessage("Hola")]
    │        state.userName = undefined
    ▼
   END
    │
    └── checkpointer guarda: { messages: [...], userName: undefined }

invoke(msg2, { thread_id: "T1" })
    │
    ▼
 respond  ← state.messages = [HumanMessage("Hola"), AIMessage("..."), HumanMessage("Me llamo N")]
    │        state.userName = undefined  (aún)
    ▼
   END  → nodo setea userName = "Nicolás"
    │
    └── checkpointer guarda: { messages: [...], userName: "Nicolás" }

invoke(msg3, { thread_id: "T1" })
    │
    ▼
 respond  ← state.userName = "Nicolás"  ✓ persiste del turno anterior
```

## Resumen

| Concepto | Qué hace |
|---|---|
| `MemorySaver` | Guarda estado en RAM (desarrollo) |
| `PostgresSaver` | Guarda estado en PostgreSQL (producción) |
| `thread_id` | Identifica la conversación |
| `MessagesAnnotation` | Acumula historial de mensajes con reducer |
| `.compile({ checkpointer })` | Conecta el checkpointer al grafo |
