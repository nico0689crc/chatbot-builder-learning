import { Module } from '@nestjs/common';
import { CanalesController } from './canales.controller';
import { IAModule } from '../ia/ia.module';

@Module({
  imports: [IAModule],
  controllers: [CanalesController],
})
export class CanalesModule {}
