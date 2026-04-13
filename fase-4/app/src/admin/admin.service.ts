import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarSystemPromptDto, ActualizarWidgetDto, CrearClienteDto, CrearParametroDto, CrearToolDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Clientes
  // ---------------------------------------------------------------------------

  crearCliente(dto: CrearClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }

  listarClientes() {
    return this.prisma.cliente.findMany({
      orderBy: { creadoEn: 'desc' },
      include: { _count: { select: { conversaciones: true } } },
    });
  }

  async obtenerCliente(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        conversaciones: { select: { id: true, sessionId: true, creadaEn: true } },
      },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  async agregarTool(clienteId: string, dto: CrearToolDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

    return this.prisma.tool.create({
      data: {
        clienteId,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        conector: {
          create: {
            tipo: dto.tipo,
            url: dto.url,
            metodo: dto.metodo ?? 'GET',
            headers: dto.headers ?? {},
          },
        },
      },
      include: { conector: true, parametros: true },
    });
  }

  async agregarParametro(toolId: string, dto: CrearParametroDto) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) throw new NotFoundException(`Tool ${toolId} no encontrada`);

    return this.prisma.parametro.create({
      data: {
        toolId,
        nombre: dto.nombre,
        tipo: dto.tipo,
        descripcion: dto.descripcion,
        requerido: dto.requerido ?? true,
      },
    });
  }

  async actualizarSystemPrompt(clienteId: string, dto: ActualizarSystemPromptDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: { systemPrompt: dto.systemPrompt },
      select: { id: true, systemPrompt: true },
    });
  }

  async actualizarWidget(clienteId: string, dto: ActualizarWidgetDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: dto,
      select: { id: true, widgetNombre: true, widgetColor: true, widgetBienvenida: true },
    });
  }

  listarTools(clienteId: string) {
    return this.prisma.tool.findMany({
      where: { clienteId },
      include: { conector: true, parametros: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Métricas básicas
  // ---------------------------------------------------------------------------

  async metricas(clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

    const [totalConversaciones, totalMensajes, ultimasConversaciones] = await Promise.all([
      this.prisma.conversacion.count({ where: { clienteId } }),
      this.prisma.mensaje.count({
        where: { conversacion: { clienteId } },
      }),
      this.prisma.conversacion.findMany({
        where: { clienteId },
        orderBy: { creadaEn: 'desc' },
        take: 5,
        include: { _count: { select: { mensajes: true } } },
      }),
    ]);

    return {
      clienteId,
      nombre: cliente.nombre,
      totalConversaciones,
      totalMensajes,
      promedioMensajesPorConversacion:
        totalConversaciones > 0
          ? Math.round((totalMensajes / totalConversaciones) * 10) / 10
          : 0,
      ultimasConversaciones,
    };
  }
}
