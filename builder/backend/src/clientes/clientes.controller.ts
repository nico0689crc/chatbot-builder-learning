import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('clientes')
export class ClientesController {
  constructor(private clientesService: ClientesService) {}

  @Get()
  findAll() {
    return this.clientesService.findAll();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.clientesService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findById(id);
  }

  @Post()
  create(
    @Body() body: { nombre: string; arquetipo: string; systemPrompt: string },
  ) {
    return this.clientesService.create(body);
  }

}
