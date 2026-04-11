# Fase 5 — Capacidades avanzadas (bajo demanda)

## Cómo usar esta fase

**No aprendas esto antes de tener un cliente que lo pida.**

Cada capacidad se aprende cuando un caso real la necesita.
Eso garantiza que el conocimiento se consolida con uso inmediato
y que el tiempo de aprendizaje genera valor real.

---

## RAG — Búsqueda en documentos del cliente

**Señal para activarlo:** Un cliente de arquetipo Asistente Interno necesita
que el bot consulte sus manuales, políticas o catálogos antes de responder.

**El problema que resuelve:** El system prompt tiene un límite de tokens.
Si el cliente tiene 200 páginas de documentación, no entran en el prompt.
RAG indexa esos documentos y busca solo los fragmentos relevantes para
cada pregunta antes de llamar al modelo.

**Qué construís:**
- Pipeline de indexación: PDF/Notion/Drive → chunks → embeddings → pgvector
- Retriever integrado en el grafo de LangGraph
- El bot cita la fuente de donde vino cada respuesta

**Recursos:**
- LangChain JS — RAG guides
- pgvector en Supabase (evita infraestructura adicional)
- `@langchain/community/vectorstores/pgvector`

**Cómo pedirle a Claude Code que te enseñe esto:**
```
Un cliente con arquetipo Asistente Interno quiere que el bot responda
sobre sus 50 documentos internos en PDF. El system prompt no alcanza.
Explicame qué es RAG, cómo funciona con LangGraph, y ayudame a construir
el pipeline de indexación para el proyecto del builder.
```

---

## Streaming de respuestas

**Señal para activarlo:** Los clientes se quejan de que el bot "tarda" en responder,
aunque la calidad de las respuestas sea buena.

**El problema que resuelve:** Sin streaming, el usuario espera en silencio hasta
que la IA termina de generar toda la respuesta. Con streaming, ve los tokens
aparecer uno a uno — la percepción de velocidad mejora dramáticamente.

**Qué construís:**
- Endpoint con Server-Sent Events (SSE)
- Widget actualizado para mostrar respuesta parcial mientras llega
- LangChain `.stream()` en lugar de `.invoke()`

**Cómo pedirle a Claude Code:**
```
Los clientes se quejan de que el bot tarda. Quiero implementar streaming
para que la respuesta aparezca token a token. Explicame Server-Sent Events
y ayudame a modificar el endpoint /chat y el widget para soportar streaming.
```

---

## Observabilidad con LangSmith

**Señal para activarlo:** Tenés 5+ clientes y no podés saber por qué el bot
falló en una conversación específica sin leer logs crudos de Railway.

**El problema que resuelve:** LangSmith traza cada conversación completa —
qué nodos del grafo corrieron, qué tools se llamaron, cuánto tardó cada paso,
dónde se tomó cada decisión. Podés reproducir cualquier conversación.

**Qué construís:**
- Integración de LangSmith (una variable de entorno + un import)
- Dashboard para ver traces de conversaciones por cliente
- Alertas cuando el bot falla o la latencia supera un umbral

**Cómo pedirle a Claude Code:**
```
Tengo 8 clientes activos y un bot falló pero no sé por qué.
Explicame LangSmith y ayudame a integrarlo en el builder
para poder trazar conversaciones por cliente_id.
```

---

## Panel para el cliente

**Señal para activarlo:** Los clientes te preguntan "¿cómo le fue al bot este mes?"
más de dos veces. Es momento de darles acceso directo.

**El problema que resuelve:** En lugar de que vos generes manualmente el reporte
mensual, el cliente lo ve en tiempo real en su propio dashboard.
También pueden editar su system prompt con preview en vivo.

**Qué construís:**
- Next.js con autenticación por `cliente_id` + JWT
- Vista de conversaciones del mes con filtros
- Los 6 KPIs del reporte mensual en tiempo real
- Editor de system prompt con preview del bot

**Cómo pedirle a Claude Code:**
```
Quiero crear un panel en Next.js donde cada cliente vea sus métricas
y pueda editar su system prompt. Ayudame a diseñar la arquitectura
de autenticación multi-tenant y los primeros dos endpoints del panel.
```

---

## Evaluación automática de calidad

**Señal para activarlo:** Actualizaste el system prompt de un cliente y
una semana después el cliente se queja de que el bot "empeoró".
Necesitás saber antes de publicar si un cambio rompe algo.

**El problema que resuelve:** Un conjunto de tests pregunta→respuesta-esperada
que corre automáticamente antes de publicar cambios al system prompt.
Si algún test falla, no se publica.

**Qué construís:**
- Tabla `TestCase` en Prisma: pregunta + respuesta esperada + criterio de éxito
- Job de evaluación que corre el bot en modo test
- CI que bloquea el deploy si algún test de un cliente activo falla

**Cómo pedirle a Claude Code:**
```
Quiero poder testear cambios al system prompt antes de publicarlos.
Ayudame a diseñar un sistema de evaluación automática con LangSmith
que compare respuestas contra casos de prueba aprobados por el cliente.
```

---

## Multi-agente

**Señal para activarlo:** Tenés clientes del arquetipo Transaccional donde
un solo agente necesita coordinar múltiples subsistemas complejos
y la calidad de las respuestas empieza a degradarse.

**El problema que resuelve:** En lugar de un agente que hace todo,
tenés un agente coordinador que delega a agentes especializados:
uno para consultas, otro para operaciones, otro para soporte.
Cada especialista es más preciso en su dominio.

**Nota:** Esta capacidad es para casos muy avanzados. La mayoría
de los clientes no la necesitan. No la construyas antes de tenerla validada.

**Cómo pedirle a Claude Code:**
```
Tengo un cliente bancario donde el bot transaccional está degradando
calidad al manejar consultas de cuentas Y operaciones Y soporte simultáneamente.
Explicame la arquitectura multi-agente de LangGraph y si tiene sentido
para este caso específico.
```
