import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

export function crearTurnosTools(clienteId: string, usuarioId: string) {

  const verificarDisponibilidad = tool(
    async ({ fecha }) => {
      const periodo = fecha ?? 'próximos días'
      const turnos = await prisma.turno.findMany({
        where: { clienteId, fecha: periodo, estado: 'disponible' },
      })

      if (turnos.length === 0) {
        return `No hay turnos disponibles para ${periodo}.`
      }

      const horarios = turnos.map(t => t.hora).join(', ')
      return `Horarios disponibles para ${periodo}: ${horarios}`
    },
    {
      name: "verificar_disponibilidad",
      description: "Consulta los horarios libres para un día específico. " +
        "Usá esta tool cuando el usuario pregunta qué turnos hay disponibles, " +
        "qué horarios tiene la clínica, o si puede sacar turno en una fecha. " +
        "Si el usuario no especifica fecha, consultá con fecha 'próximos días'.",
      schema: z.object({
        fecha: z.string().optional().describe("La fecha a consultar, ej: 'martes', '2025-04-15'. Si no se especifica, se consultan los próximos días disponibles."),
      }),
    }
  )

  const crearTurno = tool(
    async ({ fecha, hora }) => {
      const turno = await prisma.turno.create({
        data: { clienteId, usuarioId, fecha, hora, estado: 'confirmado' },
      })
      return `Turno creado para el ${turno.fecha} a las ${turno.hora} (ID: ${turno.id})`
    },
    {
      name: "crear_turno",
      description: "Crea un turno para un día y hora específicos. " +
        "Usá esta tool cuando el usuario quiere sacar un turno y ya sabe el día y la hora.",
      schema: z.object({
        fecha: z.string().describe("La fecha del turno, ej: 'martes', '2025-04-15'"),
        hora: z.string().describe("La hora del turno, ej: '10:00', '15:00'"),
      }),
    }
  )

  const cancelarTurno = tool(
    async ({ fecha, hora }) => {
      const resultado = await prisma.turno.updateMany({
        where: { clienteId, usuarioId, fecha, hora, estado: 'confirmado' },
        data: { estado: 'cancelado' },
      })

      if (resultado.count === 0) {
        return `No se encontró un turno confirmado para el ${fecha} a las ${hora}.`
      }

      return `Turno cancelado para el ${fecha} a las ${hora}.`
    },
    {
      name: "cancelar_turno",
      description: "Cancela un turno para un día y hora específicos. " +
        "Usá esta tool cuando el usuario quiere cancelar un turno y ya sabe el día y la hora.",
      schema: z.object({
        fecha: z.string().describe("La fecha del turno, ej: 'martes', '2025-04-15'"),
        hora: z.string().describe("La hora del turno, ej: '10:00', '15:00'"),
      }),
    }
  )

  return [verificarDisponibilidad, crearTurno, cancelarTurno]
}
