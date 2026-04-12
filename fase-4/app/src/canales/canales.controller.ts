import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { IAService } from '../ia/ia.service';
import type { TenantRequest } from '../common/types/tenant-request.interface';
import { HumanMessage } from '@langchain/core/messages';

@Controller('chat')
export class CanalesController {
  constructor(private iaService: IAService) {}

  @Post()
  async chat(
    @Req() request: TenantRequest,
    @Body() body: { mensaje: string; sessionId: string },
  ) {
    if (!body.mensaje || !body.sessionId) {
      throw new BadRequestException('mensaje y sessionId requeridos');
    }

    const cliente = request.cliente;
    const grafo = await this.iaService.buildGraph(
      cliente.arquetipo,
      cliente.systemPrompt,
      cliente.id,
    );

    const config = {
      configurable: { thread_id: `${cliente.id}-${body.sessionId}` },
    };
    const result = await grafo.invoke(
      { messages: [new HumanMessage(body.mensaje)] },
      config,
    );

    const last = result.messages[result.messages.length - 1];
    return { respuesta: last.content };
  }
}
