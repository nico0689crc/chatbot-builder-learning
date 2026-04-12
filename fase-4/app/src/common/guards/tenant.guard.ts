import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientesService } from '../../clientes/clientes.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private clientesService: ClientesService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const clienteId = request.headers['x-client-id'];

    if (!clienteId) {
      throw new UnauthorizedException('Header x-client-id requerido');
    }

    const cliente = await this.clientesService.findById(clienteId);
    request.cliente = cliente;
    return true;
  }
}
