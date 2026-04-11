# SKILL: debug-bot

## Cuándo leer este archivo

Leé este archivo cuando el bot no se comporta como se espera.
Aplica cuando el usuario dice:
- "El bot no está respondiendo bien"
- "El bot llamó a la tool incorrecta"
- "El bot no escaló cuando debería"
- "La respuesta está cortada / es muy larga"
- "El bot olvidó el contexto de la conversación"
- "El bot inventó información"

---

## Diagnóstico en 3 preguntas

Antes de tocar cualquier código o configuración, hacerle al usuario:

1. **¿Qué mensaje mandó el usuario exactamente?**
   → El texto exacto, no una parafrase

2. **¿Qué esperaba que respondiera el bot?**
   → El comportamiento esperado concreto

3. **¿Qué respondió realmente?**
   → El texto exacto de la respuesta

Sin estas tres cosas, el debug es a ciegas.

---

## Mapa de síntomas → causas → soluciones

### El bot inventa información

**Síntoma:** El bot afirma cosas que no están en el system prompt ni en ninguna tool.

**Causas probables:**
1. Temperatura demasiado alta (> 0.5 para bots informativos)
2. System prompt no tiene límites claros sobre qué no puede decir
3. El modelo intenta ser "útil" rellenando vacíos de información

**Solución:**
```typescript
// 1. Bajar temperatura en ConfigCliente
temperatura: 0.2  // para FAQ y Turnos

// 2. Agregar al system prompt:
// "IMPORTANTE: No inventes información que no esté explícitamente
//  en este prompt. Si no tenés el dato, decí honestamente que
//  no lo sabés y derivá al contacto del negocio."
```

---

### El bot no llama a la tool cuando debería

**Síntoma:** El usuario pregunta por disponibilidad de turnos y el bot responde
con información genérica sin consultar la agenda.

**Causas probables:**
1. La descripción de la tool no está clara o no cubre el caso
2. El modelo eligió responder directamente porque tenía "suficiente" información
3. El agente no tiene las tools disponibles para ese cliente

**Diagnóstico:**
```typescript
// Verificar que el cliente tiene la tool habilitada en la DB
const tools = await prisma.tool.findMany({
  where: { clienteId: '[ID]', habilitada: true }
})
console.log('Tools del cliente:', tools.map(t => t.nombre))
```

**Solución:**
```typescript
// Mejorar la descripción de la tool — ser más específico sobre cuándo usarla
description: `SIEMPRE usa esta función cuando el usuario:
  - Pregunte si hay turnos disponibles
  - Quiera saber los horarios libres
  - Mencione fechas específicas para sacar turno
  Incluso si creés que podés responder sin consultar, usá esta función
  para asegurarte de que la información esté actualizada.`
```

---

### El bot llama a la tool incorrecta

**Síntoma:** El usuario pide cancelar un turno y el bot llama a `verificar_disponibilidad`.

**Causa:** Las descripciones de las tools se superponen — la IA no puede distinguir cuándo usar cada una.

**Solución:** Revisar todas las descripciones de tools del arquetipo juntas.
Cada una debe tener una condición de uso que no se solape con las demás.

```typescript
// ❌ Superpuesto — la IA no sabe cuándo usar cuál
'verificar_disponibilidad': 'Para consultas sobre turnos'
'crear_turno': 'Para operaciones con turnos'

// ✅ Sin superposición
'verificar_disponibilidad': `Cuando el usuario SOLO pregunta si hay lugar
  o quiere saber los horarios disponibles. NO cuando ya eligió un horario.`
'crear_turno': `SOLO cuando el usuario ya eligió una fecha y hora específica
  y quiere confirmar/reservar ese turno. NO para consultar disponibilidad.`
```

---

### El bot olvidó el contexto

**Síntoma:** El usuario menciona su nombre en el mensaje 1 y en el mensaje 5 el bot
pregunta de nuevo cómo se llama.

**Causas probables:**
1. `maxHistorial` demasiado bajo — los mensajes anteriores se cortaron
2. Error en `obtenerHistorial` — no está cargando el historial correctamente
3. El historial no se está guardando en la DB

**Diagnóstico:**
```typescript
// Verificar que el historial se guarda correctamente
const historial = await prisma.mensaje.findMany({
  where: { conversacionId: '[ID_CONVERSACION]' },
  orderBy: { timestamp: 'asc' }
})
console.log('Historial:', historial.length, 'mensajes')
console.log(historial.map(m => `${m.rol}: ${m.contenido.substring(0, 50)}`))
```

**Solución:**
```typescript
// Si el historial se guarda bien pero el bot olvida:
// Aumentar maxHistorial en ConfigCliente
maxHistorial: 10  // en lugar de 6

// Si el historial no se guarda:
// Revisar que guardarMensaje se llama después de cada turno, no antes
await guardarMensaje(conversacionId, 'user', texto)
await guardarMensaje(conversacionId, 'assistant', respuesta)
// El orden importa — siempre user primero, assistant después
```

---

### Respuestas cortadas o incompletas

**Síntoma:** Las respuestas del bot se cortan a mitad de una oración.

**Causa:** `maxTokens` demasiado bajo para el tipo de respuesta que genera.

**Solución:**
```typescript
// Aumentar maxTokens en ConfigCliente según el arquetipo
// FAQ: 150 tokens ≈ 100 palabras ≈ 2-3 oraciones cortas
// Soporte: 300 tokens ≈ 200 palabras ≈ párrafo con pasos
maxTokens: 300  // aumentar según necesidad

// También revisar el system prompt:
// "Respondé de forma concisa — máximo 3 oraciones"
// Si el prompt pide respuestas largas pero maxTokens es bajo, habrá cortes
```

---

### El bot no escala cuando debería

**Síntoma:** El usuario pide hablar con una persona y el bot sigue respondiendo.

**Causas probables:**
1. El system prompt no tiene instrucción de escalado
2. La condición de escalado en el grafo no está cubriendo ese caso
3. La detección de intención no reconoce que el usuario quiere escalar

**Solución en system prompt:**
```
ESCALADO OBLIGATORIO — en estos casos exactos:
- Si el usuario escribe: "quiero hablar con una persona / alguien / un humano"
- Si el usuario escribe: "me comuniques con un asesor / agente / vendedor"
- Respondé EXACTAMENTE: "Por supuesto, te comunico con uno de nuestros
  asesores ahora mismo. [ACCIÓN DE ESCALADO]"
```

**Solución en el grafo:**
```typescript
// Verificar que la arista condicional cubre el caso
(estado) => {
  const ultimoMensaje = estado.mensajes.at(-1)?.content as string
  const querieHumano = /persona|humano|asesor|agente|vendedor/i.test(ultimoMensaje)
  if (querieHumano) return 'preparar_escalado'
  // ... resto de condiciones
}
```

---

## Herramientas de debug disponibles

### Ver la conversación completa en la DB
```bash
# En Prisma Studio (interfaz visual)
npx prisma studio

# O con query directa
ts-node -e "
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.mensaje.findMany({
  where: { conversacion: { clienteId: '[ID]' } },
  orderBy: { timestamp: 'asc' },
  take: 20
}).then(m => m.forEach(msg => console.log(msg.rol + ':', msg.contenido)))
"
```

### Probar el system prompt directamente
```bash
# Llamada directa a la API de Claude sin el builder
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-20240307",
    "max_tokens": 250,
    "system": "[SYSTEM PROMPT DEL CLIENTE]",
    "messages": [{"role": "user", "content": "[MENSAJE PROBLEMÁTICO]"}]
  }'
```

### Activar logs del agente LangChain
```typescript
// En ia.service.ts, activar verbose temporalmente para debug
const agente = createToolCallingAgent({ llm, tools, prompt })
const executor = new AgentExecutor({
  agent: agente,
  tools,
  verbose: true,  // ← activa logs de cada decisión del agente
})
// Desactivar antes de producción
```
