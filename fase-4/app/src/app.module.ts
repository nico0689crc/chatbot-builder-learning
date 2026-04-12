import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { IAModule } from './ia/ia.module';
import { CanalesModule } from './canales/canales.module';
import { TenantGuard } from './common/guards/tenant.guard';

@Module({
  imports: [PrismaModule, ClientesModule, IAModule, CanalesModule],
  providers: [
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
