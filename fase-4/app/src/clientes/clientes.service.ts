import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async findAll() {
    return this.prisma.cliente.findMany({ where: { activo: true } });
  }

  async create(data: {
    nombre: string;
    arquetipo: string;
    systemPrompt: string;
  }) {
    return this.prisma.cliente.create({ data });
  }
}
