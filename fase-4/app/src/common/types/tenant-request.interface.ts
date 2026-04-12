import { Request } from 'express';
import { Cliente } from '@prisma/client';

export interface TenantRequest extends Request {
  cliente: Cliente;
}
