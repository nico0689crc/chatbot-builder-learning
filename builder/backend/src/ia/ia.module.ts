import { Module } from '@nestjs/common';
import { IAService } from './ia.service';
import { ToolExecutorService } from './tool-executor.service';
import { GraphInterpreterService } from './graph-interpreter.service';
import { LlmFactoryService } from './llm-factory.service';

@Module({
  providers: [IAService, ToolExecutorService, GraphInterpreterService, LlmFactoryService],
  exports: [IAService],
})
export class IAModule {}
