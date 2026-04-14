# Tipos de nodos del grafo

La clave para entender el flujo es entender qué hace cada tipo de nodo.

---

## Tipos de nodos

### `llm_call`
Llama a Gemini con:
- El system prompt del cliente
- Todo el historial de mensajes (`state.messages`)
- Opcionalmente, tools bindeadas (`bindTools`)

Gemini responde con una de dos opciones:
- **Texto normal** → quiere responder directamente al usuario → el router va a `__end__`
- **`tool_calls`** → dice "necesito ejecutar esta tool antes de responder" → el router va a `tool_executor`

Si tiene `outputFields` en su config, usa structured output: el LLM responde con un objeto JSON y cada key se escribe directamente al estado (no agrega mensajes).

**Config:**
```ts
{
  modelName?: string;           // default: 'gemini-2.5-flash'
  outputFields?: {              // si se define, usa structured output
    [campo: string]: 'string' | 'number' | 'boolean'
  }
}
```

---

### `tool_executor`
Ejecuta las tools que el LLM pidió en su respuesta anterior.

- Lee el último mensaje del estado (que tiene `tool_calls`)
- Ejecuta la función JavaScript correspondiente
- Agrega el resultado al historial como un `ToolMessage`
- **Siempre** vuelve al nodo `llm_call` que lo llamó (arista incondicional, `condicion: null`)

No toma ninguna decisión — solo ejecuta y devuelve.

---

### `classifier`
Llama al LLM con un prompt específico para clasificar el mensaje del usuario en una categoría.

- No agrega mensajes al historial
- Escribe el resultado directamente en un campo del estado (ej: `categoria = 'consulta'`)
- El router posterior lee ese campo para decidir a dónde ir

Puede clasificar múltiples campos en paralelo (config `fields`).

**Config:**
```ts
{
  categories: string[];   // ej: ['consulta', 'turno', 'urgencia']
  prompt: string;         // instrucción para clasificar
  field?: string;         // campo del estado donde escribir (default: 'classification')
  fields?: Array<{ field, categories, prompt }>  // multi-campo
}
```

---

### `condition`
Nodo de routing puro — no ejecuta ningún LLM, solo lee un campo del estado y elige la arista.

- Lee un campo del estado (ej: `escalated`)
- Usa un `mapping` para convertir el valor en un destino
- Si el valor no matchea ninguna clave, usa `default`

**Config:**
```ts
{
  field: string;                        // campo del estado a evaluar
  mapping: Record<string, string>;      // valor -> label de arista
  default: string;                      // label si no hay match
}
```

**Diferencia con `classifier`:**

| | `classifier` | `condition` |
|---|---|---|
| Llama al LLM | Sí | No |
| Decide basándose en | El mensaje del usuario | Un campo ya escrito en el estado |
| Útil para | Entender intención | Branching lógico puro |

**Ejemplo:** verificar si el usuario ya fue escalado antes de continuar:
```ts
{
  nombre: 'check_escalado',
  tipo: 'condition',
  orden: 1,
  config: {
    field: 'escalated',
    mapping: { 'true': 'handoff' },
    default: 'clasificador',
  },
}
```

---

### `http_request`
Hace un fetch a una URL externa y guarda el resultado en el estado.

- No involucra al LLM
- Útil para consultar APIs externas (ej: buscar turnos disponibles)
- Puede extraer múltiples campos del JSON de respuesta con dot-path (`fieldMap`)

**Config:**
```ts
{
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  resultField?: string;                         // un solo campo
  fieldMap?: { [estadoField]: 'dot.path' }      // múltiples campos
}
```

---

### `human_handoff`
Escala la conversación a un operador humano.

- Llama al LLM con un mensaje de escalación para responderle al usuario
- Escribe `escalated: true` en el estado
- Siempre termina en `__end__`

**Config:**
```ts
{
  message: string;          // mensaje que el LLM usa para responderle al usuario
  escalatedField?: string;  // campo del estado donde escribir true (default: 'escalated')
}
```

---

## El ciclo ReAct

El patrón ReAct (Reasoning + Acting) se arma combinando un `llm_call` con un `tool_executor`:

```
llm_call
  ├─ (tool_calls en respuesta) → tool_executor → [ejecuta tool] ──┐
  │                                                                 │
  └─────────────────────────────────────────────────────────────── ┘
  │
  └─ (respuesta de texto) → __end__
```

Las aristas necesarias son siempre estas tres:
```ts
{ origen: 'agente',  destino: 'tools',  condicion: 'tools'  }  // condicional
{ origen: 'agente',  destino: '__end__', condicion: '__end__' }  // condicional
{ origen: 'tools',   destino: 'agente', condicion: null      }  // incondicional
```

El LLM puede dar N vueltas al ciclo antes de responder — cada vuelta ejecuta una tool y agrega su resultado al historial.

---

## Ejemplo: flujo de la clínica

```
__start__
    │
    ▼
clasificador          ← lee el mensaje y escribe categoria en el estado
    ├─ 'consulta'  → agente_faq ⇄ tools_faq    (ReAct: puede llamar consultar_especialidades)
    ├─ 'turno'     → agente_turnos ⇄ tools      (ReAct: puede buscar/reservar turnos)
    └─ 'urgencia'  → handoff → __end__
```
