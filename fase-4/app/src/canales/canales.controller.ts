import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { IAService } from '../ia/ia.service';
import { ClientesService } from '../clientes/clientes.service';
import { HumanMessage } from '@langchain/core/messages';

@Controller('chat')
export class CanalesController {
  constructor(
    private iaService: IAService,
    private clientesService: ClientesService,
  ) {}

  @Post()
  async chat(
    @Headers('x-client-id') clienteId: string,
    @Body() body: { mensaje: string; sessionId: string },
  ) {
    if (!clienteId) throw new BadRequestException('Header x-client-id requerido');
    if (!body.mensaje || !body.sessionId) throw new BadRequestException('mensaje y sessionId requeridos');

    const cliente = await this.clientesService.findById(clienteId);
    const grafo = this.iaService.buildGraph(cliente.arquetipo as any, cliente.systemPrompt);

    const config = { configurable: { thread_id: `${clienteId}-${body.sessionId}` } };
    const result = await grafo.invoke(
      { messages: [new HumanMessage(body.mensaje)] },
      config,
    );

    const last = result.messages[result.messages.length - 1];
    return { respuesta: last.content };
  }
}
