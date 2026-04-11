# Conceptos — Fase 2: LangChain LCEL

## 1. De SDK directo a LangChain

En Fase 1 usabas el SDK de Google directamente:

```typescript
// Fase 1 — SDK de Google directo
const model = genAI.getGenerativeModel({
  model: config.modelo,
  systemInstruction: config.systemPrompt,  // atado al modelo
})

const history = historial.map(m => ({
  role: m.rol === 'assistant' ? 'model' : 'user',  // formato Gemini-específico
  parts: [{ text: m.contenido }],
}))

const chat = model.startChat({ history })
const result = await chat.sendMessage(mensajeNuevo)
return result.response.text()
```

El problema es que todo es Gemini-específico: los roles (`'model'` en vez de `'assistant'`), el formato del historial (`parts: [{ text }]`), cómo va el system prompt, cómo extraés la respuesta. Si mañana cambiás de modelo, reescribís todo.

Con LangChain, el mismo código funciona con cualquier modelo. Cambiás una línea:

```typescript
// Gemini
const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" })

// OpenAI — todo lo demás queda igual
const model = new ChatOpenAI({ model: "gpt-4o" })
```

---

## 2. Los cuatro conceptos de LCEL

### ChatGoogleGenerativeAI

El wrapper LangChain para Gemini. Recibe los mismos parámetros (`model`, `temperature`) pero habla el idioma LangChain internamente — mensajes universales en vez de formato Gemini.

```typescript
const model = new ChatGoogleGenerativeAI({
  model: config.modelo,
  temperature: config.temperatura,
})
```

### ChatPromptTemplate

Define la estructura del prompt como una plantilla con slots (`{variable}`). Los slots se rellenan al invocar, no al definir.

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "{systemPrompt}"],          // slot para el system prompt del cliente
  new MessagesPlaceholder("historial"),  // slot para el historial de mensajes
  ["human", "{input}"],                  // slot para el mensaje nuevo
])
```

### MessagesPlaceholder

Un slot especial para una **lista** de mensajes. A diferencia de `{variable}` que reemplaza un string, `MessagesPlaceholder` expande un array de `HumanMessage`/`AIMessage` en el lugar correcto del prompt.

### LCEL y `.pipe()`

LCEL (LangChain Expression Language) conecta pasos en secuencia. Cada paso recibe la salida del anterior:

```typescript
const chain = prompt.pipe(model).pipe(new StringOutputParser())
```

| Paso | Recibe | Devuelve |
|------|--------|----------|
| `prompt` | `{ systemPrompt, historial, input }` | array de mensajes formateados |
| `model` | array de mensajes | objeto `AIMessage` |
| `StringOutputParser` | objeto `AIMessage` | `string` limpio |

Sin el parser, `chain.invoke()` devuelve un objeto `AIMessage { content: "..." }`. Con el parser devuelve directamente el string.

---

## 3. ChatPromptTemplate como contrato

`ChatPromptTemplate` no es solo una plantilla — es un **contrato** entre quien define el prompt y quien lo invoca.

El template declara qué datos necesita:
- `systemPrompt` → el rol y las reglas del bot para este cliente
- `historial` → los mensajes previos de la conversación
- `input` → el mensaje nuevo del usuario

Quien invoca la chain tiene que cumplir ese contrato:

```typescript
chain.invoke({
  systemPrompt: config.systemPrompt,  // dato del cliente en DB
  historial: mensajesHistorial,        // historial convertido a HumanMessage/AIMessage
  input: mensajeNuevo,                 // mensaje del usuario
})
```

Si falta alguno de los tres, LangChain tira error en runtime.

**Por qué importa en multi-tenant:** el template se define una vez. Los 50 clientes tienen distintos `systemPrompt` (un restaurante, una clínica, una inmobiliaria), pero todos usan la misma estructura. El template no sabe nada del cliente. El cliente no sabe nada del template. Se conectan solo en el `invoke()`.

Sin template, tendrías que armar el array a mano en cada llamada, repitiendo la lógica de estructura para cada cliente:

```typescript
// Sin template — lógica repetida por cada cliente
const messages = [
  { role: "system", content: cliente.systemPrompt },
  ...historial,
  { role: "user", content: mensajeNuevo },
]
```

Con template, la estructura es un contrato separado del contenido.

---

## 4. HumanMessage y AIMessage

En Fase 1 el historial usaba el formato Gemini (`role: 'model'`). LangChain usa clases universales:

```typescript
// Fase 1 — formato Gemini
{ role: 'model', parts: [{ text: "..." }] }

// Fase 2 — formato LangChain (universal)
new AIMessage("...")
new HumanMessage("...")
```

La conversión es un `map` sobre el historial:

```typescript
const mensajesHistorial = historial.map(m =>
  m.rol === 'user' ? new HumanMessage(m.contenido) : new AIMessage(m.contenido)
)
```

Estos objetos los entiende cualquier modelo LangChain sin cambios adicionales.

---

## 5. Flujo completo

```
chain.invoke({ systemPrompt, historial, input })
         │
         ▼
   ChatPromptTemplate
   ┌─────────────────────────────┐
   │ [system]  "Sos un asistente │  ← systemPrompt del cliente (DB)
   │ [user]    "¿Qué días abren?"│  ← historial previo
   │ [assistant] "Lunes a sáb..." │
   │ [user]    "¿Y el domingo?"  │  ← input nuevo
   └─────────────────────────────┘
         │
         ▼
   ChatGoogleGenerativeAI
   → llama a Gemini API
         │
         ▼
   StringOutputParser
   → extrae el string de la respuesta
         │
         ▼
   "El domingo estamos cerrados."
```
