import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetricasModule } from '../metricas/metricas.module';

@Module({
  imports: [MetricasModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
