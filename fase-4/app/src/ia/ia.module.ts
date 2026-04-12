import { Module } from '@nestjs/common';
import { IAService } from './ia.service';

@Module({
  providers: [IAService],
  exports: [IAService],
})
export class IAModule {}
