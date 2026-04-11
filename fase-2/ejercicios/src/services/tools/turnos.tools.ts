import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const verificarDisponibilidad = tool(
  async ({ fecha }) => {
    return `Horarios disponibles para ${fecha}: 10:00, 15:00, 17:00`
  },
  {
    name: "verificar_disponibilidad",
    description: "Consulta los horarios libres para un día específico. " +
      "Usá esta tool cuando el usuario pregunta qué turnos hay disponibles, " +
      "qué horarios tiene la clínica, o si puede sacar turno en una fecha.",
    schema: z.object({
      fecha: z.string().describe("La fecha a consultar, ej: 'martes', '2025-04-15'"),
    }),
  }
)

export const crearTurno = tool(
  async ({ fecha, hora }) => {
    return `Turno creado para el ${fecha} a las ${hora}`
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

export const cancelarTurno = tool(
  async ({ fecha, hora }) => {
    return `Turno cancelado para el ${fecha} a las ${hora}`
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