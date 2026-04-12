import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AdminService } from './admin.service';
import { CrearClienteDto, CrearParametroDto, CrearToolDto } from './admin.dto';

@Public()
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

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
  metricas(@Param('id') clienteId: string) {
    return this.adminService.metricas(clienteId);
  }
}
