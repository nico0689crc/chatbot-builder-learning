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
  const conversacionId = await obtenerOCrearConversacion(config.id, usuarioId)
  const historial = await obtenerHistorial(conversacionId)
  await guardarMensaje(conversacionId, 'user', texto)
  const respuesta = await generarRespuesta(config, historial, texto)
  await guardarMensaje(conversacionId, 'assistant', respuesta)
  return respuesta
}

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { nombre: 'Clínica San Martín' },
  })

  if (!cliente) {
    throw new Error('Corré seed-turnos.ts primero')
  }

  const config: ConfigCliente = {
    id: cliente.id,
    nombre: cliente.nombre,
    arquetipo: Arquetipo.TURNOS,
    systemPrompt: cliente.systemPrompt,
    modelo: cliente.modelo,
    temperatura: cliente.temperatura,
    maxTokens: cliente.maxTokens,
    maxHistorial: cliente.maxHistorial,
    canales: [Canal.WEB],
    activo: cliente.activo,
    createdAt: cliente.creadoEn,
  }

  const usuarioId = 'paciente-test-1'

  console.log('👤 Quiero turno para el martes')
  const resp1 = await enviarMensaje(config, usuarioId, 'Quiero turno para el martes')
  console.log('🤖 Bot:', resp1)

  console.log('\n👤 El martes a las 10 me viene bien')
  const resp2 = await enviarMensaje(config, usuarioId, 'El martes a las 10 me viene bien')
  console.log('🤖 Bot:', resp2)

  console.log('\n👤 ¿Cuáles son los horarios disponibles?')
  const resp3 = await enviarMensaje(config, usuarioId, '¿Cuáles son los horarios disponibles?')
  console.log('🤖 Bot:', resp3)

  console.log('\n👤 Hola, ¿cómo están?')
  const resp4 = await enviarMensaje(config, usuarioId, 'Hola, ¿cómo están?')
  console.log('🤖 Bot:', resp4)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
