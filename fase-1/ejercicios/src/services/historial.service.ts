import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { Mensaje } from '@shared/types/chatbot.types'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

/**
 * Busca una conversación activa para (clienteId + usuarioId).
 * Si no existe, la crea.
 * Devuelve el id de la conversación.
 */
export async function obtenerOCrearConversacion(
  clienteId: string,
  usuarioId: string
): Promise<string> {
  let conversacion = await prisma.conversacion.findFirst({
    where: { clienteId, usuarioId },
  })

  if (!conversacion) {
    conversacion = await prisma.conversacion.create({
      data: {
        clienteId,
        usuarioId,
      },
    })
  }

  return conversacion.id
}

/**
 * Guarda un mensaje en la conversación.
 * Se llama dos veces por turno: una para el mensaje del usuario,
 * otra para la respuesta del bot.
 */
export async function guardarMensaje(
  conversacionId: string,
  rol: 'user' | 'assistant',
  contenido: string
): Promise<void> {
  await prisma.mensaje.create({
    data: {
      conversacionId,
      rol,
      contenido,
    },
  })
}

/**
 * Trae todos los mensajes de una conversación en orden cronológico.
 * El orden ASC es crítico — la IA necesita ver la conversación
 * de más antiguo a más nuevo.
 */
export async function obtenerHistorial(
  conversacionId: string
): Promise<Mensaje[]> {
  const mensajes = await prisma.mensaje.findMany({
    where: { conversacionId },
    orderBy: { creadoEn: 'asc' },
  })

  return mensajes.map((m) => ({
    id: m.id,
    conversacionId: m.conversacionId,
    rol: m.rol as 'user' | 'assistant',
    contenido: m.contenido,
    timestamp: m.creadoEn,
  }))
}
