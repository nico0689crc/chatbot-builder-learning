import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { IAModule } from './ia/ia.module';
import { CanalesModule } from './canales/canales.module';

@Module({
  imports: [PrismaModule, ClientesModule, IAModule, CanalesModule],
})
export class AppModule {}
