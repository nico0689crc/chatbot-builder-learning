import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { IAService } from '../ia/ia.service';
import { MetricasService } from '../metricas/metricas.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantRequest } from '../common/types/tenant-request.interface';
import { HumanMessage } from '@langchain/core/messages';

@Controller('chat')
export class CanalesController {
  constructor(
    private iaService: IAService,
    private metricasService: MetricasService,
    private prisma: PrismaService,
  ) {}

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
      cliente.id,
      cliente.systemPrompt,
    );

    const config = {
      configurable: { thread_id: `${cliente.id}-${body.sessionId}` },
    };
    const result = await grafo.invoke(
      { messages: [new HumanMessage(body.mensaje)] },
      config,
    );

    const last = result.messages[result.messages.length - 1];
    const respuesta =
      typeof last.content === 'string'
        ? last.content
        : JSON.stringify(last.content);

    // Persistir conversación y mensaje, luego registrar métricas
    void this.persistirYRegistrar(
      cliente.id,
      body.sessionId,
      body.mensaje,
      respuesta,
    );

    return { respuesta };
  }

  private async persistirYRegistrar(
    clienteId: string,
    sessionId: string,
    mensajeUsuario: string,
    respuestaBot: string,
  ): Promise<void> {
    const conversacion = await this.prisma.conversacion.upsert({
      where: { clienteId_sessionId: { clienteId, sessionId } },
      create: { clienteId, sessionId },
      update: {},
    });

    await this.prisma.mensaje.createMany({
      data: [
        { conversacionId: conversacion.id, rol: 'user', contenido: mensajeUsuario },
        { conversacionId: conversacion.id, rol: 'assistant', contenido: respuestaBot },
      ],
    });

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: { cerradaEn: new Date() },
    });

    await this.metricasService.registrarCierre(conversacion.id);
  }
}
