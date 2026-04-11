# Stack tecnológico — Decisiones y justificaciones

> Por qué elegimos cada tecnología y cuándo reconsiderarla.

---

## Lenguaje: TypeScript

**Por qué:** Ya sabés JavaScript. TypeScript agrega tipos estáticos que son especialmente valiosos en un sistema multi-tenant donde distintos clientes tienen distintas configuraciones — los tipos evitan bugs difíciles de detectar como pasar el `systemPrompt` de un cliente a otro.

**Cuándo reconsiderar:** Nunca para este proyecto. Python tiene un ecosistema de IA más maduro, pero LangChain JS + LangGraph JS tienen paridad de features con la versión Python.

---

## Framework web: Express → NestJS

**Express (Fases 1–3):** Mínima configuración, máxima flexibilidad. Perfecto para aprender la mecánica sin que el framework te imponga estructura.

**NestJS (Fase 4+):** Módulos, guards e inyección de dependencias. El TenantGuard de NestJS resuelve el multi-tenant de forma elegante — se aplica globalmente y cada request tiene el contexto del cliente disponible automáticamente.

**Cuándo migrar de Express a NestJS:** Cuando tengas 3+ módulos de dominio (clientes, conversaciones, IA) y empieces a duplicar lógica entre routes.

---

## ORM: Prisma

**Por qué:** Migraciones versionadas (sabés exactamente qué cambios aplicaste a la DB), tipado automático de queries (si el schema cambia, el código falla en compilación no en runtime), y una sintaxis legible que hace obvia la intención del código.

**Alternativas consideradas:**
- TypeORM: más complejo, decoradores que confunden al principio
- Drizzle: más liviano pero ecosistema más chico
- SQL directo: sin migraciones controladas, difícil de mantener

---

## Base de datos: PostgreSQL

**Por qué:** ACID (no perdés datos en fallas), JSON nativo (útil para configuraciones variables), excelente soporte de Prisma, y con `pgvector` podés agregar búsqueda vectorial para RAG sin infraestructura adicional.

**Railway PostgreSQL:** Incluida en el plan de Railway, sin configuración adicional, backups automáticos.

**Cuándo agregar MongoDB:** Si el volumen de conversaciones supera millones/mes y necesitás escalar horizontalmente la escritura. Para los primeros años, PostgreSQL alcanza perfectamente.

---

## Caché: Redis

**Por qué:** El historial de conversación se lee en cada mensaje. Sin Redis, cada mensaje hace una query a PostgreSQL (~40–80ms). Con Redis en memoria, son ~2ms. La diferencia se percibe en la velocidad de respuesta del bot.

**Qué cachear:**
- Historial reciente (últimos N mensajes) — TTL: 30 minutos de inactividad
- Configuración del cliente — TTL: 5 minutos (se actualiza si el cliente edita su config)

**Cuándo agregarlo:** No desde el día 1. Agregalo cuando los tiempos de respuesta empiecen a ser perceptibles (generalmente con 5+ clientes activos).

---

## Framework de IA: LangChain JS + LangGraph JS

**LangChain:** Abstrae la conexión con modelos, maneja memory modules, define tools con esquemas Zod, y orquesta agentes. El ecosistema más grande para IA en producción.

**LangGraph:** Extiende LangChain para flujos con estados y decisiones condicionales. Indispensable para los arquetipos de Soporte y Transaccional donde el flujo tiene bifurcaciones reales.

**Por qué no Vercel AI SDK:** Está optimizado para apps web con IA (una app, un modelo). El builder necesita multi-tenant con grafos dinámicos por arquetipo — eso no encaja con el diseño de Vercel AI SDK.

**Por qué no construir desde cero:** LangGraph maneja checkpointers, streaming, human-in-the-loop y multi-agente. Construir eso desde cero tomaría meses.

---

## Modelo de IA: Claude (Anthropic)

**Por qué Claude:** Mejor comprensión de instrucciones complejas (los system prompts del builder son detallados), mejor manejo de contexto largo (importantes cuando el historial es extenso), y mejor relación calidad/costo con Haiku para casos de negocio.

**Modelos disponibles:**
- `claude-haiku-20240307`: rápido y económico, para FAQ y Turnos
- `claude-sonnet-4-5`: equilibrio calidad/costo, para Ventas y Soporte
- `claude-opus-4-5`: máxima calidad, para Transaccional complejo

**Por qué no OpenAI:** GPT-4o es excelente, pero el ecosistema de herramientas de Anthropic (prompt caching, extended thinking) tiene ventajas específicas para este caso. El builder puede soportar ambos — la abstracción de LangChain permite cambiar el modelo con una línea.

---

## Deploy: Railway

**Por qué Railway:** PostgreSQL + Redis + backend en un solo proyecto, deploy automático desde GitHub (git push = deploy), pricing predecible, y excelente DX (developer experience).

**Costo estimado:**
- 0–3 clientes: ~$10–15 USD/mes
- 5–10 clientes: ~$20–30 USD/mes
- 10–20 clientes: ~$40–60 USD/mes (momento de evaluar Fly.io)

**Alternativas:**
- **Render:** Similar a Railway, plan gratis generoso pero cold starts en el free tier
- **Fly.io:** Más control, deploy global (menor latencia para usuarios en distintos países), más complejo de configurar
- **AWS/GCP:** Para cuando tengas 50+ clientes y necesites control total — no antes

---

## Herramientas de desarrollo

| Herramienta | Uso |
|------------|-----|
| `ts-node` | Ejecutar TypeScript directamente en desarrollo |
| `nodemon` | Reinicio automático en desarrollo |
| `zod` | Validación de schemas para tools y API |
| `dotenv` | Variables de entorno |
| `@anthropic-ai/sdk` | Cliente oficial de Anthropic |
| `@langchain/anthropic` | Integración LangChain + Claude |
| `@langchain/langgraph` | Grafos de estados |

---

## Lo que NO usamos y por qué

| Tecnología | Por qué no |
|-----------|-----------|
| Vercel AI SDK | Optimizado para apps web, no para builder multi-tenant |
| NestJS desde el día 1 | Overhead innecesario para aprender la mecánica base |
| MongoDB desde el inicio | PostgreSQL alcanza para varios años de crecimiento |
| Redis desde el día 1 | Agrégatelo cuando el volumen lo justifique |
| Docker en desarrollo | Railway maneja el deploy — Docker agrega complejidad sin beneficio ahora |
| Microservicios | Un monolito bien estructurado escala perfectamente hasta 100+ clientes |
