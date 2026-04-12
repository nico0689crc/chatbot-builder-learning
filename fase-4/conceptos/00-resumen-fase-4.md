# Resumen Fase 4 — Builder multi-tenant completo

## Estado actual (sesiones 10 y 11 completas)

### Lo que está funcionando

```
POST /clientes     → crear cliente con arquetipo y system prompt
GET  /clientes     → listar clientes activos
GET  /clientes/:id → detalle de un cliente
POST /chat         → chatear con el bot del cliente
```

### Flujo end-to-end

```
1. Crear cliente
POST /clientes
{ "nombre": "Clínica Demo", "arquetipo": "faq", "systemPrompt": "Sos un asistente..." }
→ { "id": "cmnwbu8gi...", "nombre": "Clínica Demo", ... }

2. Chatear
POST /chat
x-client-id: cmnwbu8gi...
{ "mensaje": "¿Cuál es el horario?", "sessionId": "sesion-1" }
→ { "respuesta": "El horario es de lunes a viernes..." }
```

---

## Arquitectura del proyecto

```
fase-4/app/src/
│
├── app.module.ts              ← raíz: ensambla módulos, registra TenantGuard global
│
├── prisma/
│   ├── prisma.service.ts      ← PrismaClient con connect/disconnect automático
│   └── prisma.module.ts       ← @Global() — disponible en toda la app sin importar
│
├── clientes/
│   ├── clientes.service.ts    ← findById, findAll, create
│   ├── clientes.controller.ts ← @Public() — no requiere x-client-id
│   └── clientes.module.ts
│
├── ia/
│   ├── ia.service.ts          ← buildGraph(arquetipo, systemPrompt, clienteId)
│   ├── tool-executor.service.ts ← loadToolsForCliente → DynamicStructuredTool[]
│   └── ia.module.ts
│
├── canales/
│   ├── canales.controller.ts  ← POST /chat — lee request.cliente del guard
│   └── canales.module.ts
│
└── common/
    ├── guards/
    │   └── tenant.guard.ts    ← valida x-client-id, inyecta cliente en request
    ├── decorators/
    │   └── public.decorator.ts ← @Public() para excluir rutas del guard
    └── types/
        └── tenant-request.interface.ts ← Request + cliente: Cliente
```

---

## Schema de base de datos

```
Cliente ─────────────── Conversacion ─── Mensaje
  │
  └── Tool ─── Conector
        └── Parametro
```

| Tabla | Propósito |
|-------|-----------|
| `Cliente` | Configuración por tenant: arquetipo, system prompt |
| `Conversacion` | Sesión de chat identificada por clienteId + sessionId |
| `Mensaje` | Historial de mensajes de cada conversación |
| `Tool` | Tool de function calling habilitada para un cliente |
| `Conector` | Cómo ejecutar la tool: API_REST o GOOGLE_SHEETS |
| `Parametro` | Argumentos que acepta la tool (genera schema Zod dinámico) |

---

## Decisiones de diseño clave

### 1. TenantGuard global con @Public()

El guard corre antes de cualquier endpoint. Los controllers no validan el cliente — lo leen de `request.cliente`. Agregar un nuevo endpoint protegido no requiere código extra.

```typescript
// Registrado una vez en AppModule
{ provide: APP_GUARD, useClass: TenantGuard }

// Excepción para rutas de administración
@Public()
@Controller('clientes')
```

### 2. IAService.buildGraph es async

Porque necesita consultar la DB para cargar las tools del cliente antes de construir el grafo:

```typescript
async buildGraph(arquetipo, systemPrompt, clienteId) {
  const tools = await this.toolExecutor.loadToolsForCliente(clienteId);
  // tools vacío → FAQ simple
  // tools con datos → grafo con ToolNode
}
```

### 3. thread_id = clienteId + sessionId

La conversación en PostgreSQL se identifica con `${clienteId}-${sessionId}`. Esto asegura que dos clientes distintos con el mismo sessionId tengan historiales independientes.

### 4. Prisma como @Global

`PrismaService` se declara global para que cualquier módulo lo pueda inyectar sin agregar `PrismaModule` a su array de imports. Es el único módulo que justifica ser global — es infraestructura base, no lógica de negocio.

---

## Lo que falta en la Fase 4

- [ ] **Sesión 12** — Widget embebible + Panel admin (alta de cliente en < 30 min)
- [ ] **Sesión 13** — Métricas: endpoint con los 6 KPIs del reporte mensual

---

## Conceptos documentados

| Archivo | Contenido |
|---------|-----------|
| [01-nestjs-modulos-y-di.md](01-nestjs-modulos-y-di.md) | Módulos, inyección de dependencias, ciclo de vida de una request |
| [02-tenant-guard.md](02-tenant-guard.md) | TenantGuard, @Public(), TenantRequest tipado |
| [03-tool-executor-y-schema.md](03-tool-executor-y-schema.md) | Schema Tool/Conector/Parametro, schema Zod dinámico, conectores |
