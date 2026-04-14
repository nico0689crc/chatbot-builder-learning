import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetricasModule } from '../metricas/metricas.module';
import { IAModule } from '../ia/ia.module';

@Module({
  imports: [MetricasModule, IAModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
