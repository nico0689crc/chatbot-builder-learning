import { Module } from '@nestjs/common';
import { IAService } from './ia.service';
import { ToolExecutorService } from './tool-executor.service';
import { GraphInterpreterService } from './graph-interpreter.service';

@Module({
  providers: [IAService, ToolExecutorService, GraphInterpreterService],
  exports: [IAService],
})
export class IAModule {}
