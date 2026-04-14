import { Injectable, Logger } from '@nestjs/common';
import { IAService } from '../ia/ia.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricasService } from '../metricas/metricas.service';
import { AdminService } from '../admin/admin.service';
import { HumanMessage } from '@langchain/core/messages';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(
    private iaService: IAService,
    private prisma: PrismaService,
    private metricasService: MetricasService,
    private adminService: AdminService,
  ) {}

  /**
   * Procesa el payload del webhook de Meta y despacha cada mensaje
   * al grafo del cliente correspondiente.
   *
   * Meta envía un objeto con múltiples entries/changes anidados.
   * Soporta WhatsApp, Messenger e Instagram (todos usan la misma estructura).
   */
  async procesarWebhook(payload: MetaWebhookPayload, clienteId: string): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages;
        if (!messages?.length) continue;

        for (const msg of messages) {
          // Solo procesamos mensajes de texto por ahora
          if (msg.type !== 'text') {
            this.logger.warn(`Tipo de mensaje no soportado: ${msg.type}`);
            continue;
          }

          const texto = msg.text?.body;
          const senderId = msg.from; // número de teléfono o PSID

          if (!texto || !senderId) continue;

          await this.procesarMensaje({ clienteId, senderId, texto });
        }
      }
    }
  }

  private async procesarMensaje({
    clienteId,
    senderId,
    texto,
  }: {
    clienteId: string;
    senderId: string;
    texto: string;
  }): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      this.logger.error(`Cliente no encontrado: ${clienteId}`);
      return;
    }

    const grafo = await this.iaService.buildGraph(clienteId, cliente.systemPrompt);

    // Usamos el senderId como sessionId para mantener memoria por usuario
    const config = { configurable: { thread_id: `${clienteId}-${senderId}` } };

    let respuesta: string;
    try {
      const result = await grafo.invoke(
        { messages: [new HumanMessage(texto)] },
        config,
      );
      const last = result.messages.findLast((m: any) => m._getType() === 'ai');
      respuesta = last
        ? typeof last.content === 'string'
          ? last.content
          : JSON.stringify(last.content)
        : 'Lo siento, no pude generar una respuesta.';
    } catch (err) {
      this.logger.error(`Error al invocar el grafo para ${clienteId}:`, err);
      return;
    }

    await this.persistirYRegistrar(clienteId, senderId, texto, respuesta);

    if (cliente.metaPhoneNumberId && cliente.metaAccessToken) {
      const accessToken = this.adminService.decrypt(cliente.metaAccessToken);
      await this.enviarRespuestaMeta(senderId, respuesta, cliente.metaPhoneNumberId, accessToken);
    } else {
      this.logger.warn(`Cliente ${clienteId} no tiene metaPhoneNumberId o metaAccessToken configurados`);
    }
  }

  private async enviarRespuestaMeta(
    to: string,
    texto: string,
    phoneNumberId: string,
    accessToken: string,
  ): Promise<void> {
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Error al enviar mensaje a Meta (${res.status}): ${error}`);
    } else {
      this.logger.log(`[Meta] Mensaje enviado a ${to}`);
    }
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

// --- Tipos del payload de Meta ---

export interface MetaWebhookPayload {
  object: string;
  entry: MetaEntry[];
}

interface MetaEntry {
  id: string;
  changes: MetaChange[];
}

interface MetaChange {
  value: MetaChangeValue;
  field: string;
}

interface MetaChangeValue {
  messaging_product?: string;
  messages?: MetaMessage[];
}

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}
