import { Module } from '@nestjs/common';
import { CanalesController } from './canales.controller';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { IAModule } from '../ia/ia.module';
import { MetricasModule } from '../metricas/metricas.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [IAModule, MetricasModule, AdminModule],
  controllers: [CanalesController, MetaController],
  providers: [MetaService],
})
export class CanalesModule {}
