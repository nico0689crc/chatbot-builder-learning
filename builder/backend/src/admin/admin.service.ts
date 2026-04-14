import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IAService } from '../ia/ia.service';
import {
  ActualizarCampoDto,
  ActualizarNodoDto,
  ActualizarSystemPromptDto,
  ActualizarToolDto,
  ActualizarWidgetDto,
  CrearAristaDto,
  CrearCampoDto,
  CrearClienteDto,
  CrearFlujoDto,
  CrearNodoDto,
  CrearParametroDto,
  CrearToolDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private iaService: IAService,
  ) {}

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
    const result = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { systemPrompt: dto.systemPrompt },
      select: { id: true, systemPrompt: true },
    });
    this.iaService.invalidateCache(clienteId);
    return result;
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

  async obtenerTool(clienteId: string, toolId: string) {
    const tool = await this.prisma.tool.findFirst({
      where: { id: toolId, clienteId },
      include: { conector: true, parametros: true },
    });
    if (!tool) throw new NotFoundException(`Tool ${toolId} no encontrada`);
    return tool;
  }

  async actualizarTool(clienteId: string, toolId: string, dto: ActualizarToolDto) {
    const tool = await this.prisma.tool.findFirst({ where: { id: toolId, clienteId } });
    if (!tool) throw new NotFoundException(`Tool ${toolId} no encontrada`);

    const { url, metodo, headers, ...toolData } = dto;

    await this.prisma.tool.update({
      where: { id: toolId },
      data: toolData,
    });

    if (url !== undefined || metodo !== undefined || headers !== undefined) {
      await this.prisma.conector.update({
        where: { toolId },
        data: { ...(url !== undefined && { url }), ...(metodo !== undefined && { metodo }), ...(headers !== undefined && { headers }) },
      });
    }

    this.iaService.invalidateCache(clienteId);
    return this.obtenerTool(clienteId, toolId);
  }

  async eliminarParametro(toolId: string, parametroId: string) {
    const param = await this.prisma.parametro.findFirst({ where: { id: parametroId, toolId } });
    if (!param) throw new NotFoundException(`Parámetro ${parametroId} no encontrado`);
    await this.prisma.parametro.delete({ where: { id: parametroId } });
    return { deleted: true };
  }

  listarTools(clienteId: string) {
    return this.prisma.tool.findMany({
      where: { clienteId },
      include: { conector: true, parametros: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Flujos
  // ---------------------------------------------------------------------------

  async crearFlujo(clienteId: string, dto: CrearFlujoDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

    // Si ya tiene un flujo, lo elimina y crea uno nuevo
    await this.prisma.flujoDef.deleteMany({ where: { clienteId } });

    const flujo = await this.prisma.flujoDef.create({
      data: { clienteId, nombre: dto.nombre, descripcion: dto.descripcion ?? '' },
      include: { campos: true, nodos: true, aristas: true },
    });

    this.iaService.invalidateCache(clienteId);
    return flujo;
  }

  async obtenerFlujo(clienteId: string) {
    const flujo = await this.prisma.flujoDef.findUnique({
      where: { clienteId },
      include: { campos: true, nodos: { orderBy: { orden: 'asc' } }, aristas: true },
    });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);
    return flujo;
  }

  async eliminarFlujo(clienteId: string) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);
    await this.prisma.flujoDef.delete({ where: { clienteId } });
    this.iaService.invalidateCache(clienteId);
    return { deleted: true };
  }

  async agregarCampo(clienteId: string, dto: CrearCampoDto) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const campo = await this.prisma.campoDef.create({
      data: {
        flujoId: flujo.id,
        nombre: dto.nombre,
        tipo: dto.tipo,
        reducer: dto.reducer,
        default: dto.default ?? 'null',
      },
    });

    this.iaService.invalidateCache(clienteId);
    return campo;
  }

  async actualizarCampo(clienteId: string, nombre: string, dto: ActualizarCampoDto) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const campo = await this.prisma.campoDef.update({
      where: { flujoId_nombre: { flujoId: flujo.id, nombre } },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.reducer !== undefined && { reducer: dto.reducer }),
        ...(dto.default !== undefined && { default: dto.default }),
      },
    });

    this.iaService.invalidateCache(clienteId);
    return campo;
  }

  async eliminarCampo(clienteId: string, nombre: string) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    await this.prisma.campoDef.delete({ where: { flujoId_nombre: { flujoId: flujo.id, nombre } } });
    this.iaService.invalidateCache(clienteId);
    return { deleted: true };
  }

  async agregarNodo(clienteId: string, dto: CrearNodoDto) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const nodo = await this.prisma.nodoDef.create({
      data: {
        flujoId: flujo.id,
        nombre: dto.nombre,
        tipo: dto.tipo,
        config: (dto.config ?? {}) as any,
        orden: dto.orden ?? 0,
      },
    });

    this.iaService.invalidateCache(clienteId);
    return nodo;
  }

  async actualizarNodo(clienteId: string, nombre: string, dto: ActualizarNodoDto) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const nodo = await this.prisma.nodoDef.update({
      where: { flujoId_nombre: { flujoId: flujo.id, nombre } },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.config !== undefined && { config: dto.config as any }),
        ...(dto.orden !== undefined && { orden: dto.orden }),
      },
    });

    this.iaService.invalidateCache(clienteId);
    return nodo;
  }

  async eliminarNodo(clienteId: string, nombre: string) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    await this.prisma.nodoDef.delete({ where: { flujoId_nombre: { flujoId: flujo.id, nombre } } });
    this.iaService.invalidateCache(clienteId);
    return { deleted: true };
  }

  async agregarArista(clienteId: string, dto: CrearAristaDto) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const arista = await this.prisma.aristaDef.create({
      data: {
        flujoId: flujo.id,
        origen: dto.origen,
        destino: dto.destino,
        condicion: dto.condicion ?? null,
      },
    });

    this.iaService.invalidateCache(clienteId);
    return arista;
  }

  async actualizarArista(clienteId: string, aristaId: string, dto: { origen?: string; destino?: string; condicion?: string | null }) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    const arista = await this.prisma.aristaDef.update({
      where: { id: aristaId },
      data: {
        ...(dto.origen !== undefined && { origen: dto.origen }),
        ...(dto.destino !== undefined && { destino: dto.destino }),
        ...(dto.condicion !== undefined && { condicion: dto.condicion }),
      },
    });
    this.iaService.invalidateCache(clienteId);
    return arista;
  }

  async eliminarArista(clienteId: string, aristaId: string) {
    const flujo = await this.prisma.flujoDef.findUnique({ where: { clienteId } });
    if (!flujo) throw new NotFoundException(`Cliente ${clienteId} no tiene flujo configurado`);

    await this.prisma.aristaDef.delete({ where: { id: aristaId } });
    this.iaService.invalidateCache(clienteId);
    return { deleted: true };
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
