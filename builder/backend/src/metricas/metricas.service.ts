import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricasService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Job de cierre — se llama al terminar una conversación
  // ---------------------------------------------------------------------------

  async registrarCierre(conversacionId: string): Promise<void> {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id: conversacionId },
      include: { mensajes: true },
    });
    if (!conversacion) return;

    const cerradaEn = conversacion.cerradaEn ?? new Date();
    const duracionMs = cerradaEn.getTime() - conversacion.creadaEn.getTime();
    const duracionMin = duracionMs / 1000 / 60;

    const escalada = conversacion.mensajes.some(
      (m) =>
        m.rol === 'assistant' &&
        (m.contenido.toLowerCase().includes('escal') ||
          m.contenido.toLowerCase().includes('agente humano')),
    );

    const periodo = this.periodoDesFecha(conversacion.creadaEn);
    const totalMensajes = conversacion.mensajes.length;

    // Upsert atómico: si ya existe el registro del mes, actualiza los acumulados
    const existing = await this.prisma.metricasMes.findUnique({
      where: {
        clienteId_periodo: {
          clienteId: conversacion.clienteId,
          periodo,
        },
      },
    });

    if (existing) {
      const nuevasDuraciones = existing.conversaciones + 1;
      const nuevaDuracionPromedio =
        (existing.duracionPromedioMin * existing.conversaciones + duracionMin) /
        nuevasDuraciones;

      await this.prisma.metricasMes.update({
        where: { id: existing.id },
        data: {
          conversaciones: { increment: 1 },
          mensajes: { increment: totalMensajes },
          conversacionesEscaladas: escalada ? { increment: 1 } : undefined,
          duracionPromedioMin: nuevaDuracionPromedio,
        },
      });
    } else {
      await this.prisma.metricasMes.create({
        data: {
          clienteId: conversacion.clienteId,
          periodo,
          conversaciones: 1,
          mensajes: totalMensajes,
          conversacionesEscaladas: escalada ? 1 : 0,
          duracionPromedioMin: duracionMin,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // KPI 1-6 — reporte mensual
  // ---------------------------------------------------------------------------

  async obtenerReporte(clienteId: string, periodo: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

    const metricas = await this.prisma.metricasMes.findUnique({
      where: { clienteId_periodo: { clienteId, periodo } },
    });

    // KPI 3: tasa de resolución
    const tasaResolucion =
      metricas && metricas.conversaciones > 0
        ? Math.round(
            ((metricas.conversaciones - metricas.conversacionesEscaladas) /
              metricas.conversaciones) *
              100,
          )
        : 100;

    // KPI 6: conversaciones por día del período
    const [anio, mes] = periodo.split('-').map(Number);
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 1);

    const conversacionesPorDia = await this.prisma.$queryRaw<
      { dia: string; total: bigint }[]
    >`
      SELECT TO_CHAR("creadaEn", 'YYYY-MM-DD') as dia, COUNT(*) as total
      FROM "Conversacion"
      WHERE "clienteId" = ${clienteId}
        AND "creadaEn" >= ${inicio}
        AND "creadaEn" < ${fin}
      GROUP BY dia
      ORDER BY dia
    `;

    // KPI 5: consultas más frecuentes (palabras clave de mensajes de usuario)
    const mensajesUsuario = await this.prisma.mensaje.findMany({
      where: {
        rol: 'user',
        conversacion: {
          clienteId,
          creadaEn: { gte: inicio, lt: fin },
        },
      },
      select: { contenido: true },
    });

    const frecuencias = this.calcularFrecuencias(mensajesUsuario.map((m) => m.contenido));

    return {
      cliente: { id: clienteId, nombre: cliente.nombre },
      periodo,
      // KPI 1
      conversacionesTotales: metricas?.conversaciones ?? 0,
      // KPI 2
      mensajesTotales: metricas?.mensajes ?? 0,
      // KPI 3
      tasaResolucionPct: tasaResolucion,
      // KPI 4
      duracionPromedioMin: Math.round((metricas?.duracionPromedioMin ?? 0) * 10) / 10,
      // KPI 5
      consultasFrecuentes: frecuencias,
      // KPI 6
      conversacionesPorDia: conversacionesPorDia.map((r) => ({
        dia: r.dia,
        total: Number(r.total),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private periodoDesFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  }

  private calcularFrecuencias(mensajes: string[]): { tema: string; count: number }[] {
    const stopwords = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'y', 'a', 'que',
      'es', 'se', 'no', 'mi', 'me', 'con', 'por', 'para', 'del', 'al',
      'lo', 'le', 'su', 'una', 'hay', 'si', 'yo', 'tu', 'te', 'como',
    ]);

    const freq: Record<string, number> = {};
    for (const msg of mensajes) {
      const palabras = msg
        .toLowerCase()
        .replace(/[^a-záéíóúüñ\s]/gi, '')
        .split(/\s+/)
        .filter((p) => p.length > 3 && !stopwords.has(p));

      for (const p of palabras) {
        freq[p] = (freq[p] ?? 0) + 1;
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tema, count]) => ({ tema, count }));
  }
}
