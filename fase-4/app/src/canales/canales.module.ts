import { Module } from '@nestjs/common';
import { CanalesController } from './canales.controller';
import { IAModule } from '../ia/ia.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [IAModule, ClientesModule],
  controllers: [CanalesController],
})
export class CanalesModule {}
