# Graph Builder Dinámico — Multi-tenant con arquetipos

## El problema que resuelve

En un sistema multi-tenant, cada cliente tiene un arquetipo distinto (FAQ, Soporte, Ventas). Sin un graph builder, el código del endpoint quedaría así:

```typescript
// ❌ Sin graph builder — lógica mezclada en el endpoint
if (tenant.arquetipo === "faq") {
  // definir grafo FAQ acá...
} else if (tenant.arquetipo === "soporte") {
  // definir grafo Soporte acá...
}
```

Esto viola el principio de responsabilidad única: el endpoint sabe demasiado. Con un **graph builder**, el endpoint solo hace:

```typescript
// ✅ Con graph builder — endpoint no sabe nada de grafos
const grafo = buildGraph(tenant.arquetipo, checkpointer);
grafo.invoke(mensaje, config);
```

---

## Estructura del graph builder

```typescript
export function buildGraph(arquetipo: Arquetipo, checkpointer: PostgresSaver) {
  switch (arquetipo) {
    case "faq":     return construirGrafoFAQ(checkpointer);
    case "soporte": return construirGrafoSoporte(checkpointer);
    default:        throw new Error(`Arquetipo desconocido: ${arquetipo}`);
  }
}
```

Cada función `construir*` define su propio grafo internamente y devuelve un grafo compilado listo para invocar. El checkpointer se pasa desde afuera — así todos los arquetipos comparten la misma instancia de PostgresSaver.

---

## grafoFAQ vs grafoSoporte — diferencias clave

| Aspecto | FAQ | Soporte |
|---------|-----|---------|
| Nodos | `model` | `model`, `tools` |
| Tools | Ninguna | `obtener_pedido`, `iniciar_devolucion`, `escalar_a_humano` |
| Aristas | `__start__ → model → __end__` | Condicional: `model → tools → model` o `model → __end__` |
| System prompt | Responder preguntas frecuentes | Usar tools cuando corresponda |
| Complejidad | Lineal | Cíclica (loop hasta terminar) |

### grafoFAQ — grafo simple

```typescript
function construirGrafoFAQ(checkpointer: PostgresSaver) {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

  async function callModel(state: State): Promise<Partial<State>> {
    const result = await model.invoke([
      new SystemMessage("Sos un asistente de FAQ. Respondé de forma breve y concisa."),
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
```

No hay tools ni routing condicional. El modelo siempre responde directo.

### grafoSoporte — grafo con bifurcaciones

```typescript
function construirGrafoSoporte(checkpointer: PostgresSaver) {
  const tools = [obtenerPedido, iniciarDevolucion, escalarAHumano];
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" }).bindTools(tools);
  const toolNode = new ToolNode(tools);

  async function callModel(state: State): Promise<Partial<State>> {
    const response = await model.invoke([
      new SystemMessage("Sos un bot de soporte. Usá las tools cuando corresponda."),
      ...state.messages
    ]);
    return { messages: [response] };
  }

  function routeAfterModel(state: State): "tools" | "__end__" {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return last.tool_calls?.length > 0 ? "tools" : "__end__";
  }

  return new StateGraph(GraphState)
    .addNode("model", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "model")
    .addConditionalEdges("model", routeAfterModel, { tools: "tools", __end__: END })
    .addEdge("tools", "model")
    .compile({ checkpointer });
}
```

---

## Cómo conecta con el multi-tenant

El `thread_id` es la clave que une al tenant con su conversación en PostgreSQL.

```
Tenant A (arquetipo: "faq",     id: "tenant-faq")
Tenant B (arquetipo: "soporte", id: "tenant-soporte")

/chat recibe: { tenantId, sessionId, mensaje }
  ↓
tenant = buscarTenant(tenantId)          // arquetipo en la DB
grafo  = buildGraph(tenant.arquetipo, checkpointer)
config = { thread_id: `${tenantId}-${sessionId}` }
result = grafo.invoke({ messages: [HumanMessage(mensaje)] }, config)
```

### ¿Por qué concatenar tenantId + sessionId?

- Solo `tenantId` → todos los usuarios del tenant comparten el mismo historial ❌
- Solo `sessionId` → riesgo de colisión entre tenants distintos ❌
- `tenantId-sessionId` → cada sesión de cada tenant es independiente ✅

---

## ¿Cuántas líneas hay que tocar para agregar un arquetipo nuevo?

Solo el graph builder:

```typescript
// Antes: solo faq y soporte
case "ventas": return construirGrafoVentas(checkpointer);  // ← agregar esto
```

Y la función `construirGrafoVentas`. El endpoint, el checkpointer, el routing HTTP — nada cambia.

---

## Flujo completo

```
POST /chat { tenantId: "abc", sessionId: "123", mensaje: "..." }
  │
  ▼
buscarTenant("abc") → { arquetipo: "soporte" }
  │
  ▼
buildGraph("soporte", checkpointer)
  │
  ▼
construirGrafoSoporte(checkpointer) → grafo compilado
  │
  ▼
grafo.invoke({ messages: [HumanMessage] }, { thread_id: "abc-123" })
  │
  ▼
[model] → ¿tool_calls? → [tools] → [model] → [END]
  │
  ▼
respuesta al usuario
```
