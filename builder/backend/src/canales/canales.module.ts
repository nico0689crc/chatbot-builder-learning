import { Module } from '@nestjs/common';
import { CanalesController } from './canales.controller';
import { IAModule } from '../ia/ia.module';
import { MetricasModule } from '../metricas/metricas.module';

@Module({
  imports: [IAModule, MetricasModule],
  controllers: [CanalesController],
})
export class CanalesModule {}
