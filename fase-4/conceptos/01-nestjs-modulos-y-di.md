# NestJS — Módulos e Inyección de Dependencias

## Por qué NestJS en vez de seguir con Express

Con Express y multi-tenant aparecen tres problemas concretos:

**1. Validación duplicada** — cada endpoint repite la misma lógica para validar el `x-client-id`. Con 10 endpoints son 10 queries idénticas a la DB.

**2. Instanciación manual de dependencias** — `new PrismaClient()` aparece en múltiples archivos. Si cambia la config de conexión, hay que buscarlo en todos lados.

**3. Sin estructura forzada** — Express no impone ninguna organización. A medida que crece el proyecto, la estructura depende del criterio de cada persona.

NestJS resuelve los tres con módulos, inyección de dependencias y guards.

---

## Estructura de módulos del builder

```
src/
  prisma/         PrismaModule (@Global) — una sola instancia para toda la app
  clientes/       ClientesModule — CRUD de configuración por cliente
  ia/             IAModule — graph builder + tool executor
  canales/        CanalesModule — endpoint /chat
  common/
    guards/       TenantGuard — valida x-client-id antes de cualquier endpoint
    decorators/   @Public() — excluye rutas del guard
    types/        TenantRequest — tipado de la request con cliente inyectado
  app.module.ts   raíz — ensambla todo
```

---

## PrismaModule como global

El decorador `@Global()` hace que `PrismaService` esté disponible en toda la app sin necesidad de importar `PrismaModule` en cada módulo que lo necesite:

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Sin `@Global()`, cada módulo que necesite Prisma tendría que agregarlo a su array `imports: []`.

`PrismaService` implementa `OnModuleInit` y `OnModuleDestroy` para conectar y desconectar limpiamente:

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

---

## Inyección de dependencias en la práctica

En vez de instanciar servicios manualmente, NestJS los inyecta por el constructor:

```typescript
// ❌ Express style
const prisma = new PrismaClient();
const clientesService = new ClientesService(prisma);

// ✅ NestJS — NestJS se encarga de instanciar y conectar todo
@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}
  // prisma ya está conectado y listo
}
```

El módulo declara qué provee y qué exporta:

```typescript
@Module({
  providers: [ClientesService],   // NestJS instancia esto
  controllers: [ClientesController],
  exports: [ClientesService],     // otros módulos pueden inyectarlo
})
export class ClientesModule {}
```

---

## Ciclo de vida de una request en NestJS

```
POST /chat { mensaje: "...", sessionId: "..." }
  │
  ▼
TenantGuard.canActivate()
  ├── lee x-client-id del header
  ├── busca el cliente en la DB
  ├── inyecta request.cliente
  └── retorna true → la request continúa
  │
  ▼
CanalesController.chat()
  ├── lee request.cliente (ya está, sin query adicional)
  ├── llama IAService.buildGraph(arquetipo, systemPrompt, clienteId)
  └── invoca el grafo con el mensaje
  │
  ▼
{ respuesta: "..." }
```

---

## Endpoints disponibles

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| `GET`  | `/clientes` | ❌ (@Public) | Lista clientes activos |
| `GET`  | `/clientes/:id` | ❌ (@Public) | Detalle de un cliente |
| `POST` | `/clientes` | ❌ (@Public) | Crear cliente nuevo |
| `POST` | `/chat` | ✅ | Enviar mensaje al bot |

El `@Public()` decorator se aplica al controller completo de clientes porque es la API de administración — en producción se protegería con autenticación de admin, no con el TenantGuard.
