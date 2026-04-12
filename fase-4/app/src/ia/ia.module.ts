import { Module } from '@nestjs/common';
import { IAService } from './ia.service';
import { ToolExecutorService } from './tool-executor.service';

@Module({
  providers: [IAService, ToolExecutorService],
  exports: [IAService],
})
export class IAModule {}
