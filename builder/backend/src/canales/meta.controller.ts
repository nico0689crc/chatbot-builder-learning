import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  Res,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetaService } from './meta.service';
import type { MetaWebhookPayload } from './meta.service';

/**
 * Webhook de Meta para WhatsApp, Messenger e Instagram.
 *
 * Rutas:
 *   GET  /webhook/meta  — verificación inicial que pide Meta al configurar el webhook
 *   POST /webhook/meta  — mensajes entrantes en tiempo real
 *
 * Ambas rutas son @Public() porque Meta no envía x-client-id.
 * El clienteId se lee del header x-meta-client-id que configuramos
 * en el panel de Meta como parte de la URL del webhook.
 */
@Public()
@Controller('webhook/meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(private metaService: MetaService) {}

  /**
   * Meta llama a este endpoint cuando guardás el webhook en el panel.
   * Debe devolver hub.challenge para verificar que el servidor es tuyo.
   *
   * Configuración en Meta for Developers:
   *   URL: https://tu-dominio.com/webhook/meta?clienteId=<id-del-cliente>
   *   Verify Token: el valor de META_VERIFY_TOKEN en tu .env
   */
  @Get()
  verificar(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook de Meta verificado correctamente');
      res.status(200).send(challenge);
    } else {
      this.logger.warn('Intento de verificación fallido — token incorrecto');
      res.status(403).send('Forbidden');
    }
  }

  /**
   * Meta envía los mensajes entrantes aquí.
   * El clienteId viene como header x-meta-client-id.
   *
   * Para apuntar distintos clientes al mismo servidor, usá URLs distintas
   * o un header personalizado que configurás en Meta.
   */
  @Post()
  @HttpCode(200)
  async recibirMensaje(
    @Body() payload: MetaWebhookPayload,
    @Query('clienteId') clienteId: string,
  ) {
    if (!clienteId) {
      throw new BadRequestException('Query param clienteId requerido');
    }

    // Siempre responder 200 rápido a Meta, procesar en background
    void this.metaService.procesarWebhook(payload, clienteId).catch((err) =>
      this.logger.error('Error procesando webhook de Meta:', err),
    );

    return { status: 'ok' };
  }
}
