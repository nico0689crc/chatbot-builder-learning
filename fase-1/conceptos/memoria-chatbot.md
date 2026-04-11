# La "memoria" de un chatbot

## La analogía del mozo sin memoria

Imaginate un mozo de restaurante que tiene un problema neurológico: **cada vez que va a la cocina, olvida todo**. No recuerda nada de la mesa, ni del cliente, ni de lo que pidió.

¿Cómo funciona igual? Antes de ir a la cocina, el cliente le escribe todo en un papel:

```
[PAPEL QUE LE ENTREGÁS AL MOZO CADA VEZ]

--- Quién sos y cómo trabajás ---
Sos el asistente del restaurante "La Parrilla de Mario".
Respondés solo sobre el menú y las reservas.
Sos amable y conciso.

--- Lo que ya pasó en la mesa ---
Cliente: ¿Tienen milanesas?
Vos: Sí, tenemos milanesas napolitanas y a la romana.
Cliente: ¿Y cuánto sale la napolitana?

--- El pedido nuevo ---
¿Cuánto sale la napolitana?
```

El mozo lee todo el papel, responde, y se va. La próxima vez, le pasás el papel actualizado con la respuesta que dio.

**La IA es ese mozo.** No tiene memoria propia. Vos le mandás todo el contexto en cada llamada.

---

## Los 3 componentes de cada llamada

```
┌─────────────────────────────────────────────────────┐
│                  CADA LLAMADA A LA IA               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. SYSTEM PROMPT                                   │
│     Quién es el bot, qué sabe, cómo se comporta    │
│     Se define una vez, aplica a toda la conv.       │
│                                                     │
│  2. HISTORIAL                                       │
│     Los turnos anteriores (user → assistant → ...)  │
│     Vos lo guardás, vos lo mandás                   │
│                                                     │
│  3. MENSAJE NUEVO                                   │
│     Lo que el usuario acaba de escribir             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

En código, la llamada se arma así:

```typescript
await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: systemPrompt,        // 1. System prompt — quién es el bot
  messages: [
    // 2. Historial — lo que ya pasó
    { role: 'user',      content: '¿Tienen milanesas?' },
    { role: 'assistant', content: 'Sí, tenemos napolitana y a la romana.' },
    // 3. Mensaje nuevo — lo que el usuario acaba de escribir
    { role: 'user',      content: '¿Cuánto sale la napolitana?' },
  ]
})
```

---

## Regla crítica: el historial siempre alterna

La IA espera que los mensajes se alternen estrictamente:

```
user → assistant → user → assistant → user
```

Si mandás dos mensajes de `user` seguidos, o empezás con `assistant`, la API tira error.
Por eso cuando guardás el historial en la DB, el orden y el rol de cada mensaje importan.

---

## Por qué esto importa para el multi-tenant

El **system prompt** es lo que diferencia a un bot de otro:

```
Bot del restaurante → system prompt con el menú y el horario
Bot de la clínica   → system prompt con los servicios y el equipo médico
Bot de la tienda    → system prompt con el catálogo y las políticas
```

**El mismo motor de IA. Distintos system prompts. Distintos bots.**

Eso es el multi-tenant: una sola instancia del servidor, configuración diferente por cliente en la DB (`ConfigCliente.systemPrompt`).

---

## Pregunta de comprensión

> ¿Qué pasaría si mandás el historial en orden incorrecto (assistant primero)?

La API de Anthropic retorna un error `400 Bad Request` porque el primer mensaje de `messages[]`
debe ser siempre de rol `user`. Si invertís el orden, el bot ni llega a responder —
falla antes de procesar nada.
