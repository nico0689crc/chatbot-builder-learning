# Fase 2 — Agente con tools (LangChain JS)

## Contexto del negocio

Antes de arrancar, leé:
- [`docs/arquetipos.md`](../docs/arquetipos.md) — secciones Agenda & Turnos y Ventas & Captación
- [`docs/guia-diseno-chatbots.md`](../docs/guia-diseno-chatbots.md) — sección 4 (Function Calling)
- [`shared/prompts/system-prompts.md`](../shared/prompts/system-prompts.md) — plantillas Turnos y Ventas

Esta fase habilita dos arquetipos nuevos: **Agenda & Turnos** y **Ventas & Captación**.
La diferencia con FAQ es que el bot ahora puede consultar datos reales antes de responder.

## Objetivo de la fase

Un agente LangChain con tres tools conectadas a PostgreSQL.
El agente decide qué tool usar según el mensaje del usuario — sin lógica condicional manual.

## Verificación de prerequisito

```
Mostrá el endpoint /chat de la Fase 1 funcionando con dos mensajes
donde el segundo demuestra memoria de la conversación.
```

## Tipos compartidos

Los tipos `ConfigTool`, `ConfigConector` y `ConfigParametro` de
[`shared/types/chatbot.types.ts`](../shared/types/chatbot.types.ts)
son la base del function calling dinámico que construís en esta fase.

---

## Sesión 4 — Migrar a LangChain (90 min)

**Entregable:** `ia.service.ts` reescrito con LangChain LCEL — mismo comportamiento, mejor estructura.

### Concepto que Claude Code explica primero
```
Mostrá lado a lado el ia.service.ts de la Fase 1 y cómo quedaría con LangChain.
¿Qué líneas desaparecen? ¿Qué conceptos nuevos aparecen?
Explicame ChatAnthropic, ChatPromptTemplate, LCEL y MessagesPlaceholder
con ejemplos del chatbot de turnos.
```

### Ejercicios
- [ ] **4.1** Instalar `@langchain/anthropic`, `@langchain/core`, `langchain`
- [ ] **4.2** Reescribir `ia.service.ts` con LCEL
- [ ] **4.3** Verificar que los tests de Fase 1 siguen pasando sin cambios

### Pregunta de comprensión
¿Qué ventaja concreta da `ChatPromptTemplate` sobre armar el array a mano
en un sistema donde distintos clientes tienen distintos system prompts?

---

## Sesión 5 — Tools y agente (2 horas)

**Entregable:** Agente que toma decisiones correctas entre 4 casos de prueba.

### Concepto que Claude Code explica primero
```
Explicame con el ejemplo de una clínica:
¿Qué es un agente en LangChain y cómo decide qué tool usar?
Mostrá el loop: piensa → decide → ejecuta → observa → responde.
¿Por qué la descripción de la tool es más importante que su nombre?
Mostrá una descripción mala vs una buena para verificar_disponibilidad.
```

### Ejercicios
- [ ] **5.1** `src/services/tools/turnos.tools.ts` — tres tools con datos ficticios
- [ ] **5.2** Agente con `createToolCallingAgent` + `AgentExecutor`
- [ ] **5.3** Integrar agente en el endpoint `/chat`

### Casos de prueba obligatorios
```
"Quiero turno para el martes"           → llama verificar_disponibilidad ✓
"El martes a las 10 me viene bien"      → llama crear_turno ✓
"¿Cuáles son los horarios disponibles?" → llama verificar_disponibilidad ✓
"Hola, ¿cómo están?"                   → responde directo sin tool ✓
```

### Pregunta de comprensión
Si el usuario dice "quiero turno pronto", ¿cómo debería responder el agente?
¿Qué debería hacer la tool si recibe una fecha ambigua?

---

## Sesión 6 — Tools con datos reales (90 min)

**Entregable:** Tools conectadas a PostgreSQL. El agente consulta y crea turnos reales.

### Ejercicios
- [ ] **6.1** Agregar modelo `Turno` al schema de Prisma + migración
- [ ] **6.2** Reemplazar datos ficticios por queries de Prisma en cada tool
- [ ] **6.3** Seed con turnos de prueba
- [ ] **6.4** Prueba end-to-end: crear un turno y consultarlo en la misma conversación

---

## Checklist de la Fase 2

- [ ] LangChain LCEL reemplazando la llamada directa — mismos tests pasan
- [ ] Tres tools definidas con descripciones claras
- [ ] Agente tomando decisión correcta en los 4 casos de prueba
- [ ] Tools conectadas a PostgreSQL con datos reales
- [ ] Historial del agente persistente entre mensajes

**Con esta fase podés ofrecer arquetipos Agenda & Turnos y Ventas & Captación.**
