# Nodos y Aristas

## Nodos

Un nodo es una función que recibe el estado y devuelve un estado parcial. Es la unidad de trabajo en LangGraph.

### Firma básica

```typescript
async function myNode(state: State): Promise<Partial<State>> {
  // leer del estado
  const { input } = state;
  
  // hacer algo
  const result = await someOperation(input);
  
  // devolver solo lo que cambió
  return { response: result };
}
```

### Tipos de nodos según lo que hacen

**Nodo de clasificación** — lógica pura sin LLM:
```typescript
async function classify(state: State): Promise<Partial<State>> {
  const keywords = ["error", "problema", "falla", "no funciona"];
  const isComplaint = keywords.some(k => state.input.toLowerCase().includes(k));
  return { category: isComplaint ? "complaint" : "question" };
}
```

**Nodo LLM** — llama al modelo de lenguaje:
```typescript
async function generateResponse(state: State): Promise<Partial<State>> {
  const llm = new ChatAnthropic({ model: "claude-sonnet-4-6" });
  const response = await llm.invoke([
    new SystemMessage("Sos un asistente de soporte."),
    new HumanMessage(state.input),
  ]);
  return { response: response.content as string };
}
```

**Nodo de herramienta** — consulta BD u otros servicios:
```typescript
async function fetchUserData(state: State): Promise<Partial<State>> {
  const user = await prisma.user.findUnique({ where: { id: state.userId } });
  return { userName: user?.name ?? "desconocido" };
}
```

**Nodo de validación** — decide si hay que reintentar:
```typescript
async function validate(state: State): Promise<Partial<State>> {
  const isValid = state.response && state.response.length > 10;
  return { retries: isValid ? state.retries : (state.retries ?? 0) + 1 };
}
```

### Registrar un nodo en el grafo

```typescript
const graph = new StateGraph(GraphState)
  .addNode("classify", classify)
  .addNode("generateResponse", generateResponse)
  // ...
```

El primer argumento es el nombre (string) que usarás en las aristas.

---

## Aristas

Las aristas conectan nodos. Definen el orden del flujo.

### Arista fija (`addEdge`)

Siempre va del nodo A al nodo B, sin condición:

```typescript
.addEdge("__start__", "classify")   // el grafo empieza en "classify"
.addEdge("handleQuestion", END)      // después de handleQuestion, termina
```

`__start__` y `END` son constantes especiales de LangGraph.

### Arista condicional (`addConditionalEdges`)

Una función examina el estado y retorna el nombre del próximo nodo:

```typescript
function router(state: State): string {
  if (state.category === "complaint") return "handleComplaint";
  if (state.category === "question") return "handleQuestion";
  return "handleDefault";
}

.addConditionalEdges("classify", router)
```

La función `router` puede retornar cualquier string que corresponda a un nodo registrado, o `END` para terminar.

### Arista condicional con mapa explícito

Podés pasar un mapa opcional como tercer argumento para mayor claridad (y mejor inferencia de TypeScript):

```typescript
.addConditionalEdges("classify", router, {
  complaint: "handleComplaint",
  question: "handleQuestion",
  default: "handleDefault",
})
```

En este caso `router` retorna una de las claves del mapa (`"complaint"`, `"question"`, `"default"`), y LangGraph resuelve el nodo destino.

### Loops con aristas condicionales

Podés volver a un nodo anterior para crear un loop controlado:

```typescript
function retryRouter(state: State): string {
  if (!state.response && state.retries < 3) return "generateResponse"; // volver
  return END;                                                           // terminar
}

.addConditionalEdges("validate", retryRouter)
```

Esto crea el ciclo: `generateResponse → validate → (si falla) → generateResponse`.

---

## Diagrama de un grafo con todo lo anterior

```
__start__
    │
    ▼
 classify ──────────────────────────────────────────┐
    │                                               │
    │ (conditional edge)                            │
    ├─── category="question"  ──▶ handleQuestion ──▶ END
    │
    └─── category="complaint" ──▶ handleComplaint ─▶ END
```

Código correspondiente:

```typescript
const graph = new StateGraph(GraphState)
  .addNode("classify", classify)
  .addNode("handleQuestion", handleQuestion)
  .addNode("handleComplaint", handleComplaint)
  .addEdge("__start__", "classify")
  .addConditionalEdges("classify", router)
  .addEdge("handleQuestion", END)
  .addEdge("handleComplaint", END)
  .compile();
```

**Nodo de pausa (human-in-the-loop)** — pausa el grafo y espera aprobación externa:

```typescript
async function confirmarEscalado(state: State): Promise<Partial<State>> {
  // interrupt() NO es un return — lanza una excepción interna que pausa el grafo
  // Al reanudar con Command({ resume: valor }), retorna ese valor
  const respuesta = interrupt("¿Confirmás el escalado a un humano? (si/no)");
  return { aprobacionOperador: respuesta };
}
```

Error frecuente al usar `interrupt()`:

```typescript
// ❌ Incorrecto — interrupt() devuelve string, no Partial<State>
return interrupt("¿Confirmás?");
// Error: Expected node to return an object or Command, received string

// ✅ Correcto — guardar el retorno de interrupt() en el estado
const respuesta = interrupt("¿Confirmás?");
return { aprobacionOperador: respuesta };
```

Para reanudar el grafo pausado:

```typescript
// El operador aprueba
await graph.invoke(new Command({ resume: "si" }), config);

// El operador rechaza
await graph.invoke(new Command({ resume: "no" }), config);
```

El nodo se re-ejecuta completo desde el principio. La diferencia: en la primera ejecución `interrupt()` pausa; en la segunda retorna el valor del `Command` inmediatamente.

---

## Errores comunes

**Nodo no conectado:** si un nodo no tiene arista de salida (y no es `END`), el grafo tira error al compilar.

**Router devuelve un nombre incorrecto:** si `router` retorna un string que no corresponde a ningún nodo registrado, el grafo tira error en tiempo de ejecución.

**Olvidar `.compile()`:** el grafo no es ejecutable hasta llamar `.compile()`.

**No llegar nunca a `END`:** un loop sin condición de salida corre indefinidamente. Siempre asegurate de tener una rama que llegue a `END`.
