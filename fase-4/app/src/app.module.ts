import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { IAModule } from './ia/ia.module';
import { CanalesModule } from './canales/canales.module';
import { AdminModule } from './admin/admin.module';
import { TenantGuard } from './common/guards/tenant.guard';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),
    PrismaModule,
    ClientesModule,
    IAModule,
    CanalesModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: TenantGuard }],
})
export class AppModule {}
