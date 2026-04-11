# Fase 1 — Bot FAQ con TypeScript directo

## Contexto del negocio

Antes de arrancar, leé:
- [`docs/arquetipos.md`](../docs/arquetipos.md) — sección "Arquetipo 1: FAQ & Info"
- [`docs/guia-diseno-chatbots.md`](../docs/guia-diseno-chatbots.md) — secciones 1 y 3
- [`shared/prompts/system-prompts.md`](../shared/prompts/system-prompts.md) — plantilla FAQ

El bot que construís en esta fase resuelve el **arquetipo FAQ & Info**:
responde preguntas frecuentes sin consultar ningún sistema externo.
Es el arquetipo más simple y el primero que podés vender a un cliente real.

## Objetivo de la fase

Un bot FAQ corriendo en Railway con historial persistente en PostgreSQL.
Podés tomarlo como base para el primer cliente real al terminar esta fase.

## Por qué sin LangChain todavía

Primero entendés la mecánica real: qué se le manda a la IA, por qué el historial
lo construís vos, cómo funciona el multi-tenant. Cuando después uses LangChain,
vas a entender exactamente qué abstrae — no vas a usar magia.

## Tipos compartidos

Usá los tipos de [`shared/types/chatbot.types.ts`](../shared/types/chatbot.types.ts).
No redefinas `ConfigCliente`, `Mensaje` ni `Conversacion` — importalos directamente.

---

## Sesión 1 — Primera respuesta de Claude (90 min)

**Entregable:** `ts-node src/scripts/test-ia.ts` muestra una respuesta de Claude.

### Concepto que Claude Code explica primero
```
Antes de escribir código, explicame con una analogía simple:
¿Cómo funciona la "memoria" de un chatbot si la IA no recuerda nada entre llamadas?
Usá el ejemplo de un bot para un restaurante.
Cubrí los tres componentes de cada llamada: system prompt, historial y mensaje nuevo.
```

### Ejercicios
- [ ] **1.1** Inicializar proyecto con TypeScript + Express + dependencias
- [ ] **1.2** Crear tipos del dominio importando de `shared/types/chatbot.types.ts`
- [ ] **1.3** `src/services/ia.service.ts` — función `generarRespuesta`
- [ ] **1.4** `src/scripts/test-ia.ts` — prueba directa sin DB

### Pregunta de comprensión
¿Qué pasaría si mandás el historial en orden incorrecto (assistant primero)?

---

## Sesión 2 — Historial persistente (90 min)

**Entregable:** Dos mensajes seguidos donde el segundo demuestra que el bot recuerda el primero.

### Concepto que Claude Code explica primero
```
¿Por qué guardar el historial en PostgreSQL y no en memoria del servidor?
¿Qué pasaría si el servidor se reinicia con 10 clientes activos?
Conectalo con el multi-tenant: ¿cómo el cliente_id separa los historiales?
```

### Ejercicios
- [ ] **2.1** Schema de Prisma con `Cliente`, `Conversacion`, `Mensaje`
- [ ] **2.2** `src/services/historial.service.ts` con las tres funciones
- [ ] **2.3** `src/scripts/seed.ts` — cliente de prueba (restaurante ficticio)

### Pregunta de comprensión
Si `obtenerHistorial` devuelve mensajes en orden incorrecto (más nuevo primero),
¿cómo afecta eso a la respuesta del bot?

---

## Sesión 3 — Endpoint completo + Deploy (2 horas)

**Entregable:** Bot en Railway con URL pública respondiendo con contexto.

### Concepto que Claude Code explica primero
```
Mostrá el flujo completo cuando un usuario manda "¿Qué días abren?":
qué pasa en cada paso desde que llega el request hasta que se guarda en la DB.
```

### Ejercicios
- [ ] **3.1** `src/routes/chat.ts` — endpoint `POST /chat`
- [ ] **3.2** `src/index.ts` — servidor Express completo
- [ ] **3.3** Prueba con `curl` — dos mensajes con contexto acumulado
- [ ] **3.4** Deploy en Railway con PostgreSQL conectada

### Prueba de aceptación
```bash
# Mensaje 1
curl -X POST https://tu-proyecto.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"clienteId": "...", "usuarioId": "u1", "texto": "¿Qué días abren?"}'

# Mensaje 2 — el bot debe recordar el contexto
curl -X POST https://tu-proyecto.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"clienteId": "...", "usuarioId": "u1", "texto": "¿Y el domingo?"}'
```

---

## Checklist de la Fase 1

- [ ] Primera respuesta de Claude en consola
- [ ] Schema de Prisma migrado sin errores
- [ ] Servicio de historial con las tres funciones funcionando
- [ ] Endpoint /chat con historial persistente entre mensajes
- [ ] Cliente de prueba creado con seed
- [ ] Deploy en Railway con URL pública
- [ ] Segundo mensaje demuestra memoria de la conversación

**Con esta fase completa, podés tomar tu primer cliente de arquetipo FAQ.**
