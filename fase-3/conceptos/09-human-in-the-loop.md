# Human-in-the-Loop (HITL) — Pausar y reanudar el grafo

## El problema que resuelve

En el bot de soporte, cuando el modelo decide llamar `escalar_a_humano`, esa acción se ejecuta **automáticamente**. En producción, ciertas acciones críticas requieren aprobación antes de ejecutarse:

- Escalar a un agente humano
- Procesar una devolución
- Emitir un reembolso
- Cancelar un pedido

Sin HITL, el grafo hace esto solo. Con HITL, el grafo **se pausa**, espera una decisión externa, y recién entonces continúa (o se cancela).

---

## La función `interrupt()`

`interrupt()` es la primitiva de LangGraph para pausar un nodo. Se comporta como un `await` que se suspende indefinidamente:

```typescript
async function confirmarEscalado(state: State): Promise<Partial<State>> {
  // 1. El grafo se pausa aquí y devuelve el control al caller
  // 2. Cuando se reanuda con Command({ resume: valor }), interrupt() retorna ese valor
  const respuesta = interrupt("¿Confirmás el escalado a un humano? (si/no)");
  return { aprobacionOperador: respuesta };
}
```

### Lo que NO es `interrupt()`

`interrupt()` **no es un `return`**. Internamente lanza una excepción especial que LangGraph captura para pausar el grafo. Por eso esta implementación es incorrecta:

```typescript
// ❌ Incorrecto — return interrupt() devuelve string, no Partial<State>
async function confirmarEscalado(state: State): Promise<Partial<State>> {
  return interrupt("¿Confirmás el escalado?");
  // Error: Expected node to return an object or Command, received string
}

// ✅ Correcto — interrupt() se llama, su retorno se guarda en el estado
async function confirmarEscalado(state: State): Promise<Partial<State>> {
  const respuesta = interrupt("¿Confirmás el escalado?");
  return { aprobacionOperador: respuesta };
}
```

---

## Extender el estado para guardar la decisión

La respuesta del operador llega como valor de retorno de `interrupt()`, no como un mensaje. Por eso hay que agregar un campo al estado para guardarla y que el router la pueda leer:

```typescript
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  aprobacionOperador: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,  // siempre reemplaza, no acumula
  }),
});
```

Sin este campo en el estado, el router no tendría forma de saber si el operador aprobó o rechazó.

---

## El ciclo de vida completo de un HITL

### Paso 1: Primera invocación — el grafo se pausa

```typescript
const resultado1 = await graph.invoke(
  { messages: [new HumanMessage("Quiero hablar con alguien urgente")] },
  { configurable: { thread_id: "hitl-test-1" } }
);
// El grafo llegó a confirmarEscalado → interrupt() → se pausó
// resultado1 contiene el estado hasta ese punto
```

LangGraph guarda el estado completo en PostgreSQL bajo `thread_id: "hitl-test-1"`. El proceso puede terminar — el estado sobrevive.

### Paso 2: Segunda invocación — el operador decide

```typescript
// Aprobación
const resultado2 = await graph.invoke(
  new Command({ resume: "si" }),
  { configurable: { thread_id: "hitl-test-1" } }
);

// Rechazo
const resultado2 = await graph.invoke(
  new Command({ resume: "no" }),
  { configurable: { thread_id: "hitl-test-1" } }
);
```

LangGraph carga el estado desde PostgreSQL, re-ejecuta `confirmarEscalado` desde `interrupt()` (que esta vez retorna `"si"` inmediatamente), guarda `aprobacionOperador: "si"` en el estado, y continúa con el routing.

---

## Re-ejecución del nodo al reanudar

Este es el detalle más importante: cuando el grafo se reanuda, **el nodo `confirmarEscalado` se ejecuta completo de nuevo** desde el principio. La diferencia es que `interrupt()` tiene dos comportamientos:

| Situación | Comportamiento de `interrupt()` |
|-----------|--------------------------------|
| Primera ejecución | Lanza excepción interna → pausa el grafo |
| Ejecución post-`resume` | Retorna el valor del `Command({ resume: valor })` |

LangGraph maneja esto internamente. El código del nodo es idéntico en ambos casos.

---

## Routing post-confirmación

```typescript
function routeAfterConfirmacion(state: State): "escalar" | "__end__" {
  if (state.aprobacionOperador?.toLowerCase() === "si") {
    return "escalar";
  }
  return "__end__";
}
```

El router lee `state.aprobacionOperador` — el campo que el nodo guardó al reanudar. Si el operador aprobó, el grafo continúa hacia `escalar_a_humano`. Si rechazó, termina.

---

## Por qué el checkpointer es obligatorio para HITL

Sin checkpointer, el estado del grafo vive solo en memoria. Si el proceso termina entre el `interrupt()` y el `resume`, el estado se pierde y no hay forma de reanudar.

Con `PostgresSaver`:
1. El estado pausado se guarda en PostgreSQL al llegar a `interrupt()`
2. El proceso puede terminar, reiniciarse, escalar — no importa
3. Cuando el operador aprueba (horas después, si hace falta), el grafo carga el estado y continúa

---

## Flujo completo

```
graph.invoke(HumanMessage)
  │
  ▼
[model] → decide escalar → tool_calls: [escalar_a_humano]
  │
  ▼ (condicional: tool_calls > 0)
[confirmar_escalado]
  │  interrupt("¿Confirmás?") → PAUSA → estado guardado en PostgreSQL
  │
  ▼ (horas después: graph.invoke(Command({ resume: "si" })))
  │  interrupt() retorna "si" → { aprobacionOperador: "si" }
  │
  ▼ (condicional: aprobacionOperador === "si")
[escalar_a_humano] → crea ticket, notifica equipo
  │
  ▼
[END]
```

---

## Variaciones del patrón

Este mismo patrón aplica a cualquier acción que requiera aprobación:

```typescript
// Antes de procesar un reembolso
const monto = interrupt(`¿Aprobás reembolso de $${monto}?`);

// Antes de cancelar un pedido
const ok = interrupt(`¿Confirmás cancelación del pedido ${pedidoId}?`);

// Revisión de contenido generado por IA antes de enviarlo
const contenido = interrupt(`Revisá este email antes de enviarlo:\n\n${emailBorrador}`);
```

El patrón es siempre el mismo: `interrupt()` pausa, `Command({ resume })` reanuda, el estado guarda la decisión.
