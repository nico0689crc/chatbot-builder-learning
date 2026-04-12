# Estado y Anotaciones en LangGraph

El estado es el corazón de LangGraph. Es el objeto que se pasa entre todos los nodos y acumula el resultado del flujo completo.

## Definir el estado con `Annotation`

LangGraph usa `Annotation` para definir el esquema del estado con TypeScript:

```typescript
import { Annotation } from "@langchain/langgraph";

const GraphState = Annotation.Root({
  input: Annotation<string>(),
  category: Annotation<string>(),
  response: Annotation<string>(),
  retries: Annotation<number>(),
});

// Extraer el tipo para usarlo en los nodos
type State = typeof GraphState.State;
```

`GraphState` tiene dos usos:
1. Se pasa al constructor `new StateGraph(GraphState)`
2. `GraphState.State` es el tipo TypeScript del estado

## Cómo los nodos modifican el estado

Los nodos **no reemplazan el estado completo** — devuelven solo las claves que cambiaron. LangGraph hace el merge:

```typescript
async function classify(state: State): Promise<Partial<State>> {
  // state.input está disponible (llegó del nodo anterior)
  // solo devuelvo lo que cambio
  return { category: "complaint" };
  // state.input e state.response se preservan intactos
}
```

Esto evita que un nodo borre accidentalmente lo que escribió otro nodo.

## Reducers: controlar cómo se hace el merge

Por defecto, cada clave se sobreescribe con el último valor. Pero podés definir un **reducer** para controlar cómo se acumula:

```typescript
const GraphState = Annotation.Root({
  messages: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  category: Annotation<string>(),
});
```

Con este reducer, si un nodo devuelve `{ messages: ["hola"] }` y otro devuelve `{ messages: ["chau"] }`, el estado final tendrá `messages: ["hola", "chau"]`.

Esto es fundamental para construir el historial de una conversación (como hace `MessagesAnnotation` en Sesión 8).

## `MessagesAnnotation`: el estado para chatbots

LangGraph exporta un estado predefinido para conversaciones:

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";

const graph = new StateGraph(MessagesAnnotation)
  .addNode("chat", chatNode)
  // ...
```

`MessagesAnnotation` tiene una sola clave `messages: BaseMessage[]` con un reducer que acumula mensajes. Equivale a:

```typescript
Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});
```

## Estado inicial al invocar

Al invocar el grafo, pasás el estado inicial. Las claves que no pasés toman el valor `default` de su Annotation (si lo definiste) o quedan `undefined`:

```typescript
const result = await graph.invoke({
  input: "Tengo un problema con mi factura",
  // category y response no se pasan → empiezan undefined
  // messages con default: () => [] → empieza como []
});
```

## Estado final

`graph.invoke()` devuelve el estado completo al final del flujo:

```typescript
const result = await graph.invoke({ input: "..." });
console.log(result.input);    // el input original (no se tocó)
console.log(result.category); // lo que escribió "classify"
console.log(result.response); // lo que escribió "handleQuestion" o "handleComplaint"
```

## Tipado estricto en los nodos

Siempre tipá el argumento y el retorno del nodo:

```typescript
// ✅ Correcto
async function myNode(state: State): Promise<Partial<State>> { ... }

// ❌ Evitar — perdés autocompletado y detección de errores
async function myNode(state: any) { ... }
```

## Extensión del estado entre sesiones

En Sesión 8 vas a agregar al estado las claves necesarias para persistencia y human-in-the-loop. El estado puede crecer sin romper los nodos existentes porque cada nodo solo toca sus propias claves.
