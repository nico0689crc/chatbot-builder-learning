import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AdminService } from './admin.service';
import { MetricasService } from '../metricas/metricas.service';
import { ActualizarWidgetDto, CrearClienteDto, CrearParametroDto, CrearToolDto } from './admin.dto';

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

  @Post('clientes/:id/tools/:toolId/parametros')
  agregarParametro(
    @Param('toolId') toolId: string,
    @Body() body: CrearParametroDto,
  ) {
    return this.adminService.agregarParametro(toolId, body);
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
