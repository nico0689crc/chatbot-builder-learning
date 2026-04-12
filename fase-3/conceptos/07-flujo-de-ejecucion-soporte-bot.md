# Flujo de Ejecución — Bot de Soporte Completo

Traza paso a paso qué sucede cuando el grafo procesa el mensaje `"Mi pedido no llegó, el número es P-9981"`.

---

## Paso a paso

### 1. `main()` arranca

```typescript
await checkpointer.setup();
```

Crea las tablas en PostgreSQL que LangGraph necesita para guardar el estado. Solo se ejecuta una vez (si ya existen, no hace nada).

---

### 2. `graph.invoke()` es llamado

```typescript
graph.invoke(
  { messages: [new HumanMessage("Mi pedido no llegó, el número es P-9981")] },
  { configurable: { thread_id: "caso-1" } }
)
```

LangGraph busca en PostgreSQL si existe estado previo para `thread_id: "caso-1"`. Como es la primera vez, arranca con estado vacío y agrega el `HumanMessage` al array.

---

### 3. Nodo `model` → `callModel(state)`

```typescript
modelConTools.invoke([
  SystemMessage("Sos un bot de soporte..."),
  HumanMessage("Mi pedido no llegó, el número es P-9981")
])
```

El modelo recibe los mensajes más la lista de tools disponibles (`obtener_pedido`, `iniciar_devolucion`, `escalar_a_humano`). Razona: *"el usuario pregunta por un pedido → debo llamar `obtener_pedido`"*.

Retorna un `AIMessage` con `tool_calls`:

```json
{
  "tool_calls": [{ "name": "obtener_pedido", "args": { "pedidoId": "P-9981" } }]
}
```

Este mensaje se agrega a `state.messages`.

---

### 4. Arista condicional → `routeAfterModel(state)`

```typescript
const lastMessage = state.messages[state.messages.length - 1];
lastMessage.tool_calls.length > 0  // true
→ retorna "tools"
```

LangGraph redirige al nodo `tools`.

---

### 5. Nodo `tools` → `ToolNode`

`ToolNode` lee el `tool_calls` del último mensaje y ejecuta `obtenerPedido({ pedidoId: "P-9981" })`:

```typescript
const pedido = pedidos.find(p => p.id === "P-9981");
// → { id: "P-9981", estado: "en_camino", estimadoEntrega: "2022-01-01" }
```

Agrega un `ToolMessage` al estado con ese resultado.

---

### 6. Arista fija `tools → model` → vuelve a `callModel`

Ahora `state.messages` tiene:

```
HumanMessage("Mi pedido no llegó...")
AIMessage(tool_calls: [obtener_pedido])
ToolMessage({ id: "P-9981", estado: "en_camino", ... })
```

El modelo recibe el historial completo. Ya tiene la información que necesitaba → responde en lenguaje natural sin llamar más tools.

Retorna un `AIMessage` con texto: *"Tu pedido P-9981 está en camino..."*

---

### 7. Arista condicional → `routeAfterModel(state)` otra vez

```typescript
lastMessage.tool_calls.length === 0  // no hay tool_calls
→ retorna "__end__"
```

---

### 8. El grafo termina

LangGraph guarda el estado completo en PostgreSQL con la clave `"caso-1"`. La próxima vez que el usuario escriba con ese `thread_id`, el historial entero estará disponible.

`main()` imprime el último mensaje:

```
Usuario: "Mi pedido no llegó, el número es P-9981"
Bot:     "Tu pedido P-9981 está en camino, con entrega estimada para el 2022-01-01."
```

---

## Flujo completo

```
invoke()
  │
  ▼
[model] → modelo decide llamar obtener_pedido
  │
  ▼ (tool_calls > 0)
[tools] → ejecuta obtenerPedido → agrega ToolMessage
  │
  ▼ (arista fija)
[model] → modelo tiene el resultado → responde en texto
  │
  ▼ (tool_calls == 0)
[END] → guarda en PostgreSQL
```

---

## Variaciones según el mensaje

| Mensaje | ¿Llama tools? | Flujo |
|---------|--------------|-------|
| `"Mi pedido no llegó, el número es P-9981"` | Sí — `obtener_pedido` | `model → tools → model → END` |
| `"¿Cuál es el horario de atención?"` | No | `model → END` |
| `"Quiero hablar con alguien"` | Sí — `escalar_a_humano` | `model → tools → model → END` |
| `"Quiero hacer una devolución del pedido P-7742"` | Sí — `iniciar_devolucion` | `model → tools → model → END` |
