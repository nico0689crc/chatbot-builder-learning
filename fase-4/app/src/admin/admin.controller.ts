import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Put } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AdminService } from './admin.service';
import { MetricasService } from '../metricas/metricas.service';
import {
  ActualizarAristaDto,
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

@Public()
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private metricasService: MetricasService,
  ) {}

  // --- Clientes ---

  @Post('clientes')
  crearCliente(@Body() body: CrearClienteDto) {
    return this.adminService.crearCliente(body);
  }

  @Get('clientes')
  listarClientes() {
    return this.adminService.listarClientes();
  }

  @Get('clientes/:id')
  obtenerCliente(@Param('id') id: string) {
    return this.adminService.obtenerCliente(id);
  }

  @Patch('clientes/:id/system-prompt')
  actualizarSystemPrompt(@Param('id') id: string, @Body() body: ActualizarSystemPromptDto) {
    return this.adminService.actualizarSystemPrompt(id, body);
  }

  @Patch('clientes/:id/widget')
  actualizarWidget(@Param('id') id: string, @Body() body: ActualizarWidgetDto) {
    return this.adminService.actualizarWidget(id, body);
  }

  // --- Tools ---

  @Post('clientes/:id/tools')
  agregarTool(@Param('id') clienteId: string, @Body() body: CrearToolDto) {
    return this.adminService.agregarTool(clienteId, body);
  }

  @Get('clientes/:id/tools')
  listarTools(@Param('id') clienteId: string) {
    return this.adminService.listarTools(clienteId);
  }

  @Get('clientes/:id/tools/:toolId')
  obtenerTool(@Param('id') clienteId: string, @Param('toolId') toolId: string) {
    return this.adminService.obtenerTool(clienteId, toolId);
  }

  @Patch('clientes/:id/tools/:toolId')
  actualizarTool(
    @Param('id') clienteId: string,
    @Param('toolId') toolId: string,
    @Body() body: ActualizarToolDto,
  ) {
    return this.adminService.actualizarTool(clienteId, toolId, body);
  }

  @Post('clientes/:id/tools/:toolId/parametros')
  agregarParametro(
    @Param('toolId') toolId: string,
    @Body() body: CrearParametroDto,
  ) {
    return this.adminService.agregarParametro(toolId, body);
  }

  @Delete('clientes/:id/tools/:toolId/parametros/:parametroId')
  eliminarParametro(
    @Param('toolId') toolId: string,
    @Param('parametroId') parametroId: string,
  ) {
    return this.adminService.eliminarParametro(toolId, parametroId);
  }

  // --- Flujos ---

  @Post('clientes/:id/flujo')
  crearFlujo(@Param('id') id: string, @Body() body: CrearFlujoDto) {
    return this.adminService.crearFlujo(id, body);
  }

  @Get('clientes/:id/flujo')
  obtenerFlujo(@Param('id') id: string) {
    return this.adminService.obtenerFlujo(id);
  }

  @Delete('clientes/:id/flujo')
  eliminarFlujo(@Param('id') id: string) {
    return this.adminService.eliminarFlujo(id);
  }

  @Post('clientes/:id/flujo/campos')
  agregarCampo(@Param('id') id: string, @Body() body: CrearCampoDto) {
    return this.adminService.agregarCampo(id, body);
  }

  @Patch('clientes/:id/flujo/campos/:nombre')
  actualizarCampo(
    @Param('id') id: string,
    @Param('nombre') nombre: string,
    @Body() body: ActualizarCampoDto,
  ) {
    return this.adminService.actualizarCampo(id, nombre, body);
  }

  @Delete('clientes/:id/flujo/campos/:nombre')
  eliminarCampo(@Param('id') id: string, @Param('nombre') nombre: string) {
    return this.adminService.eliminarCampo(id, nombre);
  }

  @Post('clientes/:id/flujo/nodos')
  agregarNodo(@Param('id') id: string, @Body() body: CrearNodoDto) {
    return this.adminService.agregarNodo(id, body);
  }

  @Patch('clientes/:id/flujo/nodos/:nombre')
  actualizarNodo(
    @Param('id') id: string,
    @Param('nombre') nombre: string,
    @Body() body: ActualizarNodoDto,
  ) {
    return this.adminService.actualizarNodo(id, nombre, body);
  }

  @Delete('clientes/:id/flujo/nodos/:nombre')
  eliminarNodo(@Param('id') id: string, @Param('nombre') nombre: string) {
    return this.adminService.eliminarNodo(id, nombre);
  }

  @Post('clientes/:id/flujo/aristas')
  agregarArista(@Param('id') id: string, @Body() body: CrearAristaDto) {
    return this.adminService.agregarArista(id, body);
  }

  @Patch('clientes/:id/flujo/aristas/:aristaId')
  actualizarArista(@Param('id') id: string, @Param('aristaId') aristaId: string, @Body() body: ActualizarAristaDto) {
    return this.adminService.actualizarArista(id, aristaId, body);
  }

  @Delete('clientes/:id/flujo/aristas/:aristaId')
  eliminarArista(@Param('id') id: string, @Param('aristaId') aristaId: string) {
    return this.adminService.eliminarArista(id, aristaId);
  }

  // --- Métricas ---

  @Get('clientes/:id/metricas')
  metricas(
    @Param('id') clienteId: string,
    @Query('periodo') periodo?: string,
  ) {
    const p = periodo ?? this.periodoActual();
    return this.metricasService.obtenerReporte(clienteId, p);
  }

  private periodoActual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
