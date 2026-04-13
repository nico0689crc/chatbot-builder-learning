import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Public()
@Controller('widget')
export class WidgetController {
  constructor(private prisma: PrismaService) {}

  @Get(':clienteId/config')
  async getConfig(@Param('clienteId') clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        nombre: true,
        activo: true,
        widgetNombre: true,
        widgetColor: true,
        widgetBienvenida: true,
      },
    });

    if (!cliente || !cliente.activo) {
      throw new NotFoundException('Widget no disponible');
    }

    return {
      clienteId: cliente.id,
      nombre: cliente.widgetNombre || cliente.nombre,
      color: cliente.widgetColor,
      bienvenida: cliente.widgetBienvenida || `Hola, ¿en qué te puedo ayudar?`,
    };
  }
}
