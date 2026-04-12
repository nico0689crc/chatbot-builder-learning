# TenantGuard — Validación multi-tenant centralizada

## El problema que resuelve

Sin guard, cada controller valida el cliente por su cuenta:

```typescript
// ❌ Repetido en cada endpoint
@Post()
async chat(@Headers('x-client-id') clienteId: string) {
  const cliente = await this.clientesService.findById(clienteId); // query duplicada
  if (!cliente) throw new UnauthorizedException();
  // lógica...
}
```

Con 10 endpoints = 10 queries redundantes + 10 lugares donde la validación podría estar mal implementada.

**El Guard se ejecuta una sola vez antes de cualquier endpoint** y pone el cliente en el contexto de la request. Los controllers lo leen sin hacer queries adicionales.

---

## Implementación

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private clientesService: ClientesService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Si la ruta tiene @Public(), no aplicar el guard
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Leer el header
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const clienteId = request.headers['x-client-id'] as string | undefined;
    if (!clienteId) throw new UnauthorizedException('Header x-client-id requerido');

    // 3. Cargar el cliente y adjuntarlo a la request
    request.cliente = await this.clientesService.findById(clienteId);
    return true;
  }
}
```

### Registro global en AppModule

```typescript
@Module({
  imports: [PrismaModule, ClientesModule, IAModule, CanalesModule],
  providers: [
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
```

`APP_GUARD` es un token especial de NestJS que registra el guard para **todas las rutas** de la aplicación.

---

## El decorator @Public()

Permite excluir rutas específicas del guard. Se implementa con `SetMetadata`:

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Uso en un controller completo:

```typescript
@Public()
@Controller('clientes')
export class ClientesController { ... }
```

O solo en un método:

```typescript
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  login() { ... }

  @Get('perfil')  // este SÍ requiere x-client-id
  perfil() { ... }
}
```

El guard lee el metadata con `Reflector` y verifica tanto el método como la clase — si alguno tiene `@Public()`, la request pasa.

---

## TenantRequest — tipado de la request extendida

Para evitar `any` en los controllers que leen `request.cliente`:

```typescript
import { Request } from 'express';
import { Cliente } from '@prisma/client';

export interface TenantRequest extends Request {
  cliente: Cliente;
}
```

Uso en el controller:

```typescript
@Post()
async chat(@Req() request: TenantRequest) {
  const cliente = request.cliente; // tipado, con autocompletado
}
```

Importante: debe importarse con `import type` cuando se usa en decoradores, por la restricción de `isolatedModules`:

```typescript
import type { TenantRequest } from '../common/types/tenant-request.interface';
```

---

## Flujo completo con guard

```
POST /chat
  x-client-id: abc123
  body: { mensaje: "...", sessionId: "..." }
         │
         ▼
  TenantGuard
    ├── @Public()? → no → continúa
    ├── header x-client-id? → "abc123" → continúa
    ├── cliente existe? → { id, arquetipo, systemPrompt, ... } → continúa
    └── request.cliente = cliente → retorna true
         │
         ▼
  CanalesController.chat(request: TenantRequest)
    └── request.cliente ya tiene el objeto Cliente completo
```

Sin el header:
```
POST /chat (sin x-client-id)
  │
  ▼
TenantGuard → 401 Unauthorized: "Header x-client-id requerido"
(el controller nunca se ejecuta)
```

Con cliente inexistente:
```
POST /chat
  x-client-id: id-que-no-existe
  │
  ▼
TenantGuard → ClientesService.findById() → NotFoundException → 404
(el controller nunca se ejecuta)
```
