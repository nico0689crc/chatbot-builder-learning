# Chatbot Builder — Plan de aprendizaje y documentación

Este repositorio tiene dos propósitos simultáneos:
1. **Aprender** a construir el builder con TypeScript + LangChain + LangGraph
2. **Operar** el builder una vez construido — agregar clientes, configurar bots, debuggear

---

## Qué es el builder cuando esté terminado

Un sistema donde agregar un cliente nuevo no requiere programar.
El motor de IA existe una sola vez. Lo que cambia por cliente es configuración en la DB.

```
Cliente nuevo llega con su negocio
    ↓
Vos hacés el discovery (docs/guia-diseno-chatbots.md)
    ↓
Identificás el arquetipo (docs/arquetipos.md)
    ↓
Escribís el system prompt (shared/skills/system-prompt.md)
    ↓
Configurás el cliente en la DB (shared/skills/new-client.md)
    ↓
Si necesita tools, las creás (shared/skills/tool-creator.md)
    ↓
El cliente pega el widget en su web
    ↓
El bot está funcionando ✓
```

**Sin tocar el motor. Sin deployar nada nuevo. Solo configuración.**

---

## Las tres capas del builder

```
Etapa 1 — CLI (Fases 1–3)     Vos usás comandos en la terminal
Etapa 2 — Panel web (Fase 4)  Vos usás formularios en un admin
Etapa 3 — SaaS (Fase 5+)      El cliente configura su propio bot
```

Cada etapa se construye sobre la anterior. No hay reescrituras.

---

## Cómo usar las skills con Claude Code

Las skills son archivos de instrucciones que Claude Code lee antes de hacer
tareas recurrentes. En lugar de explicar cada vez cómo hacer algo,
la skill lo define una vez y Claude Code lo aplica consistentemente.

### Cómo invocar una skill

```
Leé shared/skills/new-client.md y después ayudame a agregar
un cliente nuevo: es una peluquería que quiere un bot de turnos.
```

```
Leé shared/skills/tool-creator.md y creá una tool para que
el bot pueda consultar el stock de productos.
```

```
Leé shared/skills/system-prompt.md y escribí el system prompt
para una clínica odontológica con estos datos: [datos del discovery]
```

```
El bot no está llamando a la tool correcta. Leé shared/skills/debug-bot.md
y ayudame a diagnosticar el problema.
```

### Las 5 skills disponibles

| Skill | Cuándo usarla |
|-------|--------------|
| `new-client.md` | Dar de alta un cliente nuevo en el builder |
| `tool-creator.md` | Crear una tool de function calling |
| `system-prompt.md` | Escribir o revisar un system prompt |
| `graph-node.md` | Agregar o modificar nodos en un grafo LangGraph |
| `debug-bot.md` | Diagnosticar por qué el bot no se comporta bien |

---

## Cómo se guardan los conceptos aprendidos

En cada sesión de tutoría, las explicaciones conceptuales se guardan como archivos `.md`
dentro de la carpeta `conceptos/` de la fase correspondiente.

```
fase-1/conceptos/memoria-chatbot.md    ← Sesión 1: cómo funciona la memoria del bot
fase-2/conceptos/...
fase-3/conceptos/...
```

Esto permite releer conceptos clave sin depender de la memoria del chat.
Claude Code los puede leer antes de continuar una sesión.

---

## Estructura del proyecto

```
chatbot-builder-learning/
│
├── README.md                          ← este archivo
│
├── docs/
│   ├── guia-diseno-chatbots.md        ← metodología completa: discovery → medición
│   └── arquetipos.md                  ← los 6 tipos de bot con detalle completo
│
├── shared/
│   ├── skills/                        ← instrucciones para Claude Code
│   │   ├── new-client.md
│   │   ├── tool-creator.md
│   │   ├── system-prompt.md
│   │   ├── graph-node.md
│   │   └── debug-bot.md
│   ├── types/
│   │   └── chatbot.types.ts           ← importar en cada fase, no redefinir
│   ├── prompts/
│   │   └── system-prompts.md          ← plantillas por arquetipo
│   └── referencias/
│       └── stack.md                   ← decisiones de stack con justificación
│
├── fase-1/                            ← Bot FAQ con TypeScript directo
│   ├── conceptos/                     ← explicaciones guardadas de cada sesión
│   ├── src/
│   └── PLAN.md
├── fase-2/                            ← Agente con tools (LangChain)
│   ├── conceptos/
│   └── PLAN.md
├── fase-3/                            ← Flujos complejos (LangGraph)
│   ├── conceptos/
│   └── PLAN.md
├── fase-4/                            ← Builder multi-tenant completo ✅
│   ├── app/                           ← Proyecto NestJS (producto real)
│   │   ├── src/
│   │   │   ├── admin/                 ← CRUD clientes, tools, métricas
│   │   │   ├── canales/               ← POST /chat
│   │   │   ├── clientes/              ← ClientesService
│   │   │   ├── ia/                    ← graph builder + tool executor
│   │   │   ├── metricas/              ← 6 KPIs del reporte mensual
│   │   │   ├── prisma/                ← PrismaService @Global
│   │   │   └── common/                ← TenantGuard, @Public(), TenantRequest
│   │   ├── prisma/schema.prisma       ← Cliente, Conversacion, Tool, MetricasMes
│   │   └── public/widget.js           ← Widget embebible
│   ├── conceptos/
│   └── PLAN.md
└── fase-5/                            ← Capacidades avanzadas (bajo demanda)
    ├── conceptos/
    └── PLAN.md
```

---

## Mapa de fases

| Fase | Qué construís | Sesiones | Arquetipos desbloqueados | Estado |
|------|--------------|----------|--------------------------|--------|
| 1 | Bot FAQ con TypeScript | 3 | FAQ & Info | ✅ Completa |
| 2 | Agente con tools (LangChain) | 3 | + Turnos, Ventas | ✅ Completa |
| 3 | Flujos con LangGraph | 3 | + Soporte, Interno | ✅ Completa |
| 4 | Builder multi-tenant | 4 | + Transaccional | ✅ Completa |
| 5 | Capacidades avanzadas | Continuo | RAG, Streaming, Panel cliente | ⬜ Pendiente |

**Estrategia:** Terminás Fase 1 → conseguís primer cliente → aprendés Fase 2 con caso real.

**Estado actual:** Fase 4 completa. El builder está operativo — podés dar de alta clientes, configurar tools desde la DB, el widget funciona y las métricas se registran automáticamente.

---

## Prompt de inicio para cada sesión

```
Sos mi tutor de desarrollo. Leé el README.md y el PLAN.md
de la fase en la que estoy.

Contexto: Estoy construyendo un builder de chatbots multi-tenant
con TypeScript + LangChain + LangGraph + Prisma + PostgreSQL.

Modo de trabajo: explicás concepto → esqueleto → yo completo → vos revisás.
Sesión de: [X minutos]
Estoy en: [FASE X — Sesión X]
Tengo funcionando: [descripción breve]
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript |
| Framework web | Express → NestJS |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Caché | Redis |
| Framework IA | LangChain JS + LangGraph JS |
| Modelo IA | Gemini (Google) |
| Deploy | Railway |

Ver [`shared/referencias/stack.md`](shared/referencias/stack.md) para justificación completa.
