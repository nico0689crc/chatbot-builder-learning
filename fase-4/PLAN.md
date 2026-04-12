# Fase 4 — Builder multi-tenant completo

## Contexto del negocio

Leé toda la documentación de [`docs/`](../docs/) antes de arrancar esta fase.
Esta es la fase donde todo el conocimiento se integra en un producto.

A partir de acá dejás de ser alguien que construye bots y pasás a ser
alguien que tiene una plataforma que los genera.

## Objetivo de la fase

Un sistema donde agregar un cliente nuevo toma 30 minutos:
1. `POST /admin/clientes` con arquetipo y system prompt
2. Habilitar tools si aplica
3. El cliente copia el widget en su web
4. El bot está funcionando

## Verificación de prerequisito

```
Mostrá el graph builder generando grafos distintos para un cliente FAQ
y un cliente de Soporte. Mismo endpoint, distintos comportamientos.
```

---

## Sesión 10 — NestJS: por qué y cómo (90 min)

**Entregable:** Proyecto migrado a NestJS con módulos por dominio.

### Concepto que Claude Code explica primero
```
Tengo Express funcionando con 3 fases de código. ¿Por qué migrar a NestJS ahora?
Mostrá un problema concreto que tengo con Express multi-tenant
y cómo NestJS lo resuelve — especialmente para el TenantGuard.
Después explicame inyección de dependencias con el ejemplo de PrismaService
que lo necesitan 4 módulos distintos.
```

### Estructura de módulos objetivo
```
src/
  clientes/     ← configuración por cliente, system prompts
  conversaciones/ ← historial, sesiones, mensajes
  ia/           ← graph builder, tool executor
  canales/      ← web controller, whatsapp controller
  common/guards/  ← TenantGuard
  common/interceptors/ ← LoggingInterceptor
  prisma/       ← PrismaService global
  app.module.ts
```

### Ejercicios
- [ ] **10.1** Instalar NestJS y migrar estructura de carpetas
- [ ] **10.2** Módulo `PrismaModule` como global
- [ ] **10.3** Módulo `ClientesModule` con servicio y controller
- [ ] **10.4** Módulo `IAModule` con el graph builder
- [ ] **10.5** Verificar que el endpoint `/chat` sigue funcionando

---

## Sesión 11 — TenantGuard + Tool Executor (2 horas)

**Entregable:** Guard que valida el cliente + executor que resuelve dos tipos de conector.

### Concepto que Claude Code explica primero
```
¿Por qué el TenantGuard es mejor que validar el cliente_id en cada controller?
¿Qué problema evita cuando tenés 10 endpoints distintos?
Mostrá cómo el guard inyecta la configuración del cliente en el contexto
y cómo cualquier servicio la consume sin hacer otra query a la DB.
```

### Ejercicios
- [ ] **11.1** `TenantGuard` — extrae y valida `cliente_id`, inyecta config en contexto
- [ ] **11.2** Aplicar el guard globalmente en `AppModule`
- [ ] **11.3** `ToolExecutorService` con soporte para `API_REST` y `GOOGLE_SHEETS`
- [ ] **11.4** Schema de Prisma: tablas `Tool`, `Conector`, `Parametro`
- [ ] **11.5** Tool executor cargando configuración de la DB

### Pregunta de comprensión
¿Por qué es importante que el executor universal no sepa de qué cliente se trata —
solo del tipo de conector?

---

## Sesión 12 — Widget + Panel admin (2 horas)

**Entregable:** Alta de cliente nuevo en menos de 30 minutos de principio a fin.

### Ejercicios
- [ ] **12.1** API de administración: CRUD de clientes
- [ ] **12.2** Endpoint para habilitar/configurar tools por cliente
- [ ] **12.3** Endpoint de métricas básicas por cliente
- [ ] **12.4** Widget embebible — snippet JS con `data-client-id`
- [ ] **12.5** Prueba end-to-end: crear cliente → configurar → widget en HTML → chatear

### Prueba de aceptación final
```bash
# 1. Crear cliente
POST /admin/clientes
{ "nombre": "Clínica San Martín", "arquetipo": "turnos", "systemPrompt": "..." }

# 2. Habilitar tool
POST /admin/clientes/:id/tools
{ "nombre": "verificar_disponibilidad", "tipo": "api_rest", "url": "..." }

# 3. Widget en HTML de prueba
<script src="https://tu-dominio.railway.app/widget.js"
        data-client-id="..."></script>

# 4. Bot responde correctamente desde el widget ✓
```

---

## Sesión 13 — Métricas y reporte mensual (90 min)

**Entregable:** Endpoint que devuelve las métricas que van en el reporte mensual al cliente.

Ver KPIs en [`docs/guia-diseno-chatbots.md`](../docs/guia-diseno-chatbots.md#kpis) — sección 5, Etapa 5.

### Ejercicios
- [ ] **13.1** Tabla `MetricasMes` en Prisma
- [ ] **13.2** Job que calcula métricas al cerrar cada conversación
- [ ] **13.3** Endpoint `GET /admin/clientes/:id/metricas?periodo=2025-06`
- [ ] **13.4** Respuesta con los 6 KPIs del reporte mensual

---

## Checklist de la Fase 4

- [x] NestJS con módulos por dominio
- [x] TenantGuard aplicado globalmente
- [x] Tool executor resolviendo API_REST y Google Sheets
- [x] Schema con tablas Tool, Conector, Parametro
- [x] Widget embebible funcionando en HTML de prueba
- [x] Alta de cliente nuevo en menos de 30 minutos
- [x] Endpoint de métricas con los 6 KPIs

**Con esta fase tenés un producto propio. Builder v1 completo.**
