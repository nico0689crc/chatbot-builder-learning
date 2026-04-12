# ¿Qué es LangGraph?

LangGraph es una librería construida sobre LangChain que te permite modelar flujos de trabajo como **grafos de estados**. En lugar de dejarle al LLM el control total del flujo, vos definís explícitamente los nodos (qué se hace) y las aristas (a dónde se va).

## El problema que resuelve

En Fase 2 construiste un agente reactivo. El flujo interno es:

```
usuario → LLM decide si usar tool → tool (opcional) → LLM responde → usuario
```

El LLM controla el loop. Eso está bien para casos simples, pero tiene límites:

- No podés pausar el flujo esperando aprobación humana
- No podés bifurcar según reglas de negocio sin que el LLM "adivine" cuál aplicar
- No podés persistir el estado a mitad del flujo
- Es difícil auditar qué rama tomó y por qué

LangGraph resuelve esto dándote **control explícito del flujo**.

## Las tres partes de un grafo

### 1. Estado (State)

Es el dato que viaja por todos los nodos. Se define una vez y todos los nodos lo leen y escriben de forma parcial.

```typescript
const GraphState = Annotation.Root({
  input: Annotation<string>(),
  category: Annotation<string>(),
  response: Annotation<string>(),
});
```

Cada nodo recibe el estado completo y devuelve solo las claves que modificó (`Partial<State>`). El grafo hace el merge automáticamente.

### 2. Nodos (Nodes)

Son funciones puras (o async) que reciben el estado y devuelven un estado parcial:

```typescript
async function classify(state: State): Promise<Partial<State>> {
  const category = state.input.includes("error") ? "complaint" : "question";
  return { category };
}
```

Un nodo puede:
- Llamar a un LLM
- Ejecutar una tool / consultar la BD
- Hacer lógica de negocio pura sin LLM
- Lanzar side-effects (enviar emails, etc.)

### 3. Aristas (Edges)

Definen a dónde va el flujo después de cada nodo. Hay dos tipos:

**Arista fija:** siempre va al mismo nodo.
```typescript
.addEdge("nodeA", "nodeB")
```

**Arista condicional:** una función decide a dónde ir según el estado.
```typescript
.addConditionalEdges("classify", router)

function router(state: State): string {
  return state.category === "complaint" ? "handleComplaint" : "handleQuestion";
}
```

## Comparación con LangChain puro (Fase 2)

| Aspecto | LangChain (Fase 2) | LangGraph |
|---|---|---|
| Control del flujo | El LLM decide | Vos definís |
| Loop | Implícito en el agente | Explícito con aristas |
| Bifurcación | El LLM infiere cuándo | `addConditionalEdges` |
| Persistencia | No tiene | Checkpointers (Sesión 8) |
| Human-in-the-loop | Muy difícil | Primera clase (Sesión 8) |
| Auditoría | Difícil | Nodo a nodo |

## Cuándo usar LangGraph vs LangChain directo

Usá **LangChain directo** cuando:
- El flujo es lineal: input → proceso → output
- El agente puede manejar el loop solo (como en Fase 2)
- No necesitás persistencia entre turnos

Usá **LangGraph** cuando:
- El flujo tiene bifurcaciones basadas en reglas de negocio
- Necesitás pausar y esperar confirmación humana
- Querés persistir conversaciones con checkpoints en BD
- Tenés múltiples "personalidades" o estrategias según el contexto del usuario

## El ciclo de vida de una invocación

```
graph.invoke({ input: "..." })
       │
       ▼
   __start__
       │
       ▼
    [Nodo 1]  ←── recibe state, devuelve Partial<State>
       │
    (edge)    ←── fija o condicional
       │
       ▼
    [Nodo 2]
       │
      END
       │
       ▼
   resultado final (state completo)
```

`__start__` y `END` son nodos especiales de LangGraph. El grafo empieza siempre desde `__start__` y termina cuando llega a `END`.

## Referencia rápida de la API

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// Definir estado
const GraphState = Annotation.Root({ ... });

// Construir grafo
const graph = new StateGraph(GraphState)
  .addNode("nombreNodo", funcionNodo)
  .addEdge("__start__", "primerNodo")
  .addEdge("nodoA", "nodoB")                        // arista fija
  .addConditionalEdges("nodoB", routerFunction)      // arista condicional
  .addEdge("nodoFinal", END)
  .compile();

// Ejecutar
const result = await graph.invoke({ input: "..." });
```
