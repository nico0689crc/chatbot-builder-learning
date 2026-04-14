import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

type ConectorResult = Record<string, unknown> | { error: string };

@Injectable()
export class ToolExecutorService {
  constructor(private prisma: PrismaService) { }

  /**
   * Carga las tools activas de un cliente desde la DB y las devuelve
   * como DynamicStructuredTool[] listas para bindTools().
   */
  async loadToolsForCliente(clienteId: string) {
    const tools = await this.prisma.tool.findMany({
      where: { clienteId, activa: true },
      include: { conector: true, parametros: true },
    });

    return tools.map((t) => {
      const schema = this.buildZodSchema(t.parametros);

      return tool(
        async (args: Record<string, unknown>) => {
          if (!t.conector) return JSON.stringify({ error: 'Tool sin conector configurado' });
          const result = await this.executeConector(t.conector, args);
          return JSON.stringify(result);
        },
        {
          name: t.nombre,
          description: t.descripcion,
          schema,
        },
      );
    });
  }

  private buildZodSchema(
    parametros: {
      nombre: string;
      tipo: string;
      descripcion: string;
      requerido: boolean;
    }[],
  ) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const p of parametros) {
      let field: z.ZodTypeAny;

      switch (p.tipo) {
        case 'number':
          field = z.number();
          break;
        case 'boolean':
          field = z.boolean();
          break;
        default:
          field = z.string();
          break;
      }

      field = field.describe(p.descripcion);
      shape[p.nombre] = p.requerido ? field : field.optional();
    }

    return z.object(shape);
  }

  private async executeConector(
    conector: { tipo: string; url: string; metodo: string; headers: unknown },
    args: Record<string, unknown>,
  ): Promise<ConectorResult> {
    switch (conector.tipo) {
      case 'API_REST':
        return this.executeApiRest(conector, args);
      case 'GOOGLE_SHEETS':
        return this.executeGoogleSheets(conector, args);
      default:
        return { error: `Tipo de conector desconocido: ${conector.tipo}` };
    }
  }

  private async executeApiRest(
    conector: { url: string; metodo: string; headers: unknown },
    args: Record<string, unknown>,
  ): Promise<ConectorResult> {
    const headers = {
      'Content-Type': 'application/json',
      ...(conector.headers as object),
    };

    let url = conector.url;
    let body: string | undefined;

    if (conector.metodo === 'GET') {
      const params = new URLSearchParams(
        Object.entries(args).map(([k, v]) => [k, String(v)]),
      );
      url = `${url}?${params.toString()}`;
      console.log("URL: ", url);
    } else {
      body = JSON.stringify(args);
      console.log("BODY: ", body);
    }

    const response = await fetch(url, {
      method: conector.metodo,
      headers,
      body,
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return response.json() as Promise<ConectorResult>;
  }

  private executeGoogleSheets(
    conector: { url: string },
    args: Record<string, unknown>,
  ): ConectorResult {
    // url = spreadsheetId
    // En una implementación real usaría googleapis.
    // Por ahora retorna un placeholder para no bloquear el flujo.
    return {
      nota: 'Google Sheets pendiente de implementación completa',
      spreadsheetId: conector.url,
      args,
    };
  }
}
