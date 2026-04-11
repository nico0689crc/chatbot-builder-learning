# Conceptos — Sesión 5: Agente con Tools

## 1. ¿Qué es un agente?

En Sesión 4, el bot siempre responde directo. No puede consultar datos externos. Si alguien pregunta "¿hay turno disponible el martes?", el bot inventa o no sabe.

Un **agente** puede consultar datos antes de responder:

```
Usuario: "¿Hay turno el martes?"
         │
         ▼
    Agente piensa:
    "Para responder esto necesito consultar disponibilidad"
         │
         ▼
    Llama a la tool: verificar_disponibilidad({ fecha: "martes" })
         │
         ▼
    Tool devuelve: ["10:00", "15:00", "17:00"]
         │
         ▼
    Agente responde:
    "Sí, tenés turnos disponibles el martes a las 10, 15 y 17hs."
```

Sin `if/else` manual. El agente decide solo qué tool usar según el mensaje del usuario.

---

## 2. El loop del agente

```
pensar → decidir → ejecutar → observar → responder
  │          │          │          │          │
  │    ¿necesito     llama a    lee el     arma la
  │    una tool?     la tool    resultado  respuesta
  │       │
  │    si no necesita tool:
  └──────────────────────────────────────────────→ responde directo
```

El agente puede ejecutar este loop **varias veces** en una sola respuesta. Por ejemplo:

```
Usuario: "Quiero turno para el próximo martes disponible"
  → verificar_disponibilidad({ fecha: "martes 15" }) → sin turnos
  → verificar_disponibilidad({ fecha: "martes 22" }) → hay turnos
  → responde con los horarios del martes 22
```

---

## 3. Por qué la descripción importa más que el nombre

El agente no "sabe" qué hace cada tool — **lee la descripción** para decidir cuándo usarla. La descripción es literalmente el criterio de decisión.

**Descripción mala:**
```typescript
{
  name: "verificar_disponibilidad",
  description: "Verifica disponibilidad",  // no dice cuándo usarla
}
```

**Descripción buena:**
```typescript
{
  name: "verificar_disponibilidad",
  description: "Consulta los horarios libres para un día específico. " +
               "Usá esta tool cuando el usuario pregunta qué turnos hay disponibles, " +
               "qué horarios tiene la clínica, o si puede sacar turno en una fecha.",
}
```

Con la descripción mala, el agente puede usar la tool cuando no debe, o no usarla cuando sí debe. Con la buena, el agente sabe exactamente en qué situación invocarla.

---

## 4. Definir una tool en LangChain

```typescript
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export const verificarDisponibilidad = tool(
  async ({ fecha }) => {
    // lógica de la tool — devuelve string
    return `Horarios disponibles para ${fecha}: 10:00, 15:00, 17:00`
  },
  {
    name: "verificar_disponibilidad",
    description:
      "Consulta los horarios libres para un día específico. " +
      "Usá esta tool cuando el usuario pregunta qué turnos hay disponibles, " +
      "qué horarios tiene la clínica, o si puede sacar turno en una fecha.",
    schema: z.object({
      fecha: z.string().describe("La fecha a consultar, ej: 'martes', '2025-04-15'"),
    }),
  }
)
```

Tres partes:
- **función** → lo que hace la tool, siempre devuelve `string`
- **name** → identificador interno (snake_case)
- **description** → el criterio de decisión del agente
- **schema** → los parámetros que el agente tiene que proveer (validados con Zod)

---

## 5. Construir el agente

```typescript
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents'

const tools = [verificarDisponibilidad, crearTurno, cancelarTurno]

const agent = createToolCallingAgent({ llm: model, tools, prompt })

const executor = new AgentExecutor({ agent, tools })

const resultado = await executor.invoke({
  systemPrompt: config.systemPrompt,
  historial: mensajesHistorial,
  input: mensajeNuevo,
})

return resultado.output  // string con la respuesta final
```

`AgentExecutor` maneja el loop internamente: ejecuta el agente, detecta si llamó a una tool, la ejecuta, pasa el resultado de vuelta al agente, y repite hasta que el agente responde directo.

---

## 6. Diferencia entre bot FAQ (Sesión 4) y agente (Sesión 5)

| | Bot FAQ | Agente |
|---|---|---|
| ¿Puede consultar datos? | No | Sí, via tools |
| ¿Decide qué hacer? | No, siempre responde | Sí, según el mensaje |
| Chain | `prompt → model → parser` | `prompt → agent → executor → tools → executor → output` |
| Output | `chain.invoke()` devuelve string | `executor.invoke()` devuelve `{ output: string }` |
| Cuándo usarlo | Preguntas frecuentes, información estática | Turnos, ventas, consultas a DB |

---

## 7. Slots reservados de LangChain

Sí, son palabras reservadas. LangChain tiene nombres fijos que `AgentExecutor` busca específicamente en el prompt:

| Slot | Quién lo llena | Para qué |
|------|---------------|----------|
| `agent_scratchpad` | `AgentExecutor` automáticamente | Borrador del agente: decisiones y resultados de tools durante el loop |
| `chat_history` | Alternativa a `MessagesPlaceholder("historial")` en algunos templates predefinidos | Historial de conversación |
| `input` | Vos en `invoke()` | El mensaje nuevo del usuario |

`agent_scratchpad` es el más importante. Mientras el agente ejecuta el loop, LangChain inyecta ahí sus pasos intermedios:

```
agent_scratchpad = [
  AIMessage("voy a llamar verificar_disponibilidad"),  // decisión del agente
  ToolMessage("10:00, 15:00, 17:00"),                  // resultado de la tool
]
```

Eso le permite al agente en la siguiente iteración saber qué ya intentó y qué obtuvo. Es su "memoria de trabajo" durante el loop — distinta al historial de conversación.

```
[system]           "Sos el asistente de la clínica..."
[historial]        conversación previa (persistida en DB)
[human]            "¿Hay turno el martes?"
[scratchpad]       ← LangChain inyecta los pasos intermedios acá
```

Cuando el agente responde directo (sin tools), el scratchpad está vacío.

Los nombres que vos elegís libremente son los slots de tus propias variables: `{systemPrompt}`, `{fecha}`, `{input}` — cualquier nombre entre llaves en el template que no sea reservado.

---

## 8. Los 4 casos de prueba obligatorios

```
"Quiero turno para el martes"           → llama verificar_disponibilidad ✓
"El martes a las 10 me viene bien"      → llama crear_turno ✓
"¿Cuáles son los horarios disponibles?" → llama verificar_disponibilidad ✓
"Hola, ¿cómo están?"                   → responde directo sin tool ✓
```

El cuarto caso es tan importante como los primeros tres: el agente no debe llamar tools innecesariamente. Si lo hace, las descripciones están mal escritas.
