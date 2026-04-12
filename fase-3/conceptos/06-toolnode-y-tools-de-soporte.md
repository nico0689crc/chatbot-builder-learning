# ToolNode y Tools de Soporte

## El problema: decisiones basadas en reglas vs. IA

En el ejercicio anterior (`03-routing-con-memoria.ts`) usaste `if/else` para clasificar la intención:

```typescript
if (input.includes("problema")) return { category: "complaint" };
if (input.includes("hablar con alguien")) return { category: "escalation" };
```

Esto tiene un problema de escala: para cada variación de lenguaje tenés que agregar una condición nueva. Un usuario que escribe "no funciona nada" o "esto es un desastre" no activa el `if ("problema")`.

La solución: dejar que el modelo de IA clasifique la intención usando **structured output**.

---

## Structured Output para clasificar intención

En lugar de pedirle al modelo una respuesta de texto libre, le pedís que responda con una estructura tipada específica. LangChain lo implementa con `.withStructuredOutput()`.

```typescript
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const IntentSchema = z.object({
  intencion: z.enum(["resolver", "herramienta", "escalar"]),
  confianza: z.number().min(0).max(1),
  razon: z.string(),
});

const model = new ChatOpenAI({ model: "gpt-4o-mini" });
const clasificador = model.withStructuredOutput(IntentSchema);

const resultado = await clasificador.invoke([
  { role: "system", content: "Clasificá la intención del usuario de soporte." },
  { role: "user", content: "no funciona nada y necesito ayuda urgente" },
]);

// resultado: { intencion: "escalar", confianza: 0.9, razon: "urgencia detectada" }
```

El modelo devuelve siempre un objeto con esa forma exacta. Si el modelo intenta salirse del schema, LangChain lo rechaza y reintenta.

---

## Tools de soporte

Las tools son funciones que el modelo puede decidir llamar. Se definen con `tool()` de LangChain:

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const obtenerPedido = tool(
  async ({ pedidoId }) => {
    // en producción: consulta a la base de datos
    return JSON.stringify({
      id: pedidoId,
      estado: "en_camino",
      estimadoEntrega: "2026-04-15",
    });
  },
  {
    name: "obtener_pedido",
    description: "Consulta el estado de un pedido por su ID",
    schema: z.object({
      pedidoId: z.string().describe("ID del pedido a consultar"),
    }),
  }
);
```

Tres tools típicas de un bot de soporte:

| Tool | Cuándo se llama | Qué retorna |
|------|----------------|-------------|
| `obtener_pedido` | Usuario pregunta por su pedido | Estado, fecha estimada, tracking |
| `iniciar_devolucion` | Usuario quiere devolver un producto | Confirmación, número de caso |
| `escalar_a_humano` | Situación compleja o usuario frustrado | Ticket de escalación, tiempo de espera |

---

## ToolNode: ejecutar tools automáticamente

`ToolNode` es un nodo predefinido de LangGraph que ejecuta las tools que el modelo pidió llamar. Recibe el estado con `tool_calls` y devuelve los resultados como `ToolMessage`.

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

const tools = [obtenerPedido, iniciarDevolucion, escalarAHumano];
const toolNode = new ToolNode(tools);
```

Cómo encaja en el grafo:

```
[INICIO] → [evaluarIntencion]
                │
                ├── tiene tool_calls → [tools] → [evaluarIntencion]  ← loop hasta resolver
                │
                └── no tiene tool_calls → [END]
```

El modelo con tools bindeadas decide si llamar una tool o responder directamente:

```typescript
const modelConTools = model.bindTools(tools);
```

---

## La arista condicional post-modelo

Después de que el modelo responde, necesitás una arista condicional que detecte si pidió llamar tools:

```typescript
import { AIMessage } from "@langchain/core/messages";

function routeAfterModel(state: State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  // si el modelo generó tool_calls → ejecutar tools
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  // si no → terminó de responder
  return "__end__";
}
```

Integrado en el grafo:

```typescript
const graph = new StateGraph(GraphState)
  .addNode("model", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "model")
  .addConditionalEdges("model", routeAfterModel, {
    tools: "tools",
    __end__: END,
  })
  .addEdge("tools", "model")  // después de tools, vuelve al modelo
  .compile({ checkpointer });
```

El loop `model → tools → model` se repite hasta que el modelo responde sin tool_calls.

---

## Por qué PostgresSaver y no MemorySaver para Soporte

`MemorySaver` guarda el estado en RAM. Si el proceso se reinicia (deploy, crash, escalado), el estado se pierde.

Para el arquetipo **Soporte & Postventa** esto es crítico:

```
Usuario abre ticket → describe problema → el servidor se reinicia → 
usuario retoma la conversación → sin PostgresSaver: el agente no sabe
nada del pedido que ya consultó, la devolución que inició, ni el contexto previo
```

Con `PostgresSaver`:

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
await checkpointer.setup(); // crea las tablas si no existen

const graph = new StateGraph(GraphState)
  // ...
  .compile({ checkpointer });
```

El estado queda en PostgreSQL con la misma base que ya usás para el resto del proyecto — sin infraestructura extra.

---

## Resumen

| Concepto | Qué hace |
|---|---|
| `.withStructuredOutput(schema)` | Obliga al modelo a responder con una estructura tipada |
| `tool(fn, { name, description, schema })` | Define una función que el modelo puede llamar |
| `model.bindTools(tools)` | Informa al modelo qué tools están disponibles |
| `ToolNode` | Nodo que ejecuta automáticamente las tools pedidas por el modelo |
| `tool_calls` en AIMessage | Lista de tools que el modelo decidió llamar |
| `PostgresSaver` | Persiste el estado del grafo en PostgreSQL entre reinicios |
