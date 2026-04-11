import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generarRespuesta } from '../services/ia.service'
import {
  obtenerOCrearConversacion,
  obtenerHistorial,
  guardarMensaje,
} from '../services/historial.service'
import type { ConfigCliente } from '@shared/types/chatbot.types'
import { Arquetipo, Canal } from '@shared/types/chatbot.types'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function enviarMensaje(config: ConfigCliente, usuarioId: string, texto: string) {
  // TODO 1: obtener o crear la conversación para (config.id, usuarioId)
  //         usar obtenerOCrearConversacion()
  const conversacionId = await obtenerOCrearConversacion(config.id, usuarioId)

  // TODO 2: traer el historial actual de esa conversación
  //         usar obtenerHistorial()
  const historial = await obtenerHistorial(conversacionId)

  // TODO 3: guardar el mensaje del usuario
  //         usar guardarMensaje() con rol 'user'
  await guardarMensaje(conversacionId, 'user', texto)

  // TODO 4: llamar a generarRespuesta() con config, historial y texto
  //         luego guardar la respuesta con rol 'assistant'
  //         y retornarla
  const respuesta = await generarRespuesta(config, historial, texto)
  await guardarMensaje(conversacionId, 'assistant', respuesta)

  return respuesta
}

async function main() {
  // Cargar el cliente desde la DB
  const cliente = await prisma.cliente.findFirst({
    where: { nombre: 'Restaurante Don Pepito' },
  })

  if (!cliente) {
    throw new Error('Corré seed.ts primero')
  }

  const config: ConfigCliente = {
    id: cliente.id,
    nombre: cliente.nombre,
    arquetipo: Arquetipo.FAQ,
    systemPrompt: cliente.systemPrompt,
    modelo: cliente.modelo,
    temperatura: cliente.temperatura,
    maxTokens: cliente.maxTokens,
    maxHistorial: cliente.maxHistorial,
    canales: [Canal.WEB],
    activo: cliente.activo,
    createdAt: cliente.creadoEn,
  }

  const usuarioId = 'usuario-test-1'

  // Mensaje 1
  console.log('👤 Usuario: ¿Qué días abren?')
  const resp1 = await enviarMensaje(config, usuarioId, '¿Qué días abren?')
  console.log('🤖 Bot:', resp1)

  // Mensaje 2 — debe recordar el contexto
  console.log('\n👤 Usuario: ¿Y el domingo?')
  const resp2 = await enviarMensaje(config, usuarioId, '¿Y el domingo?')
  console.log('🤖 Bot:', resp2)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
