import { Router, Request, Response } from 'express'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generarRespuesta } from '../services/ia.service'
import {
  obtenerOCrearConversacion,
  obtenerHistorial,
  guardarMensaje,
} from '../services/historial.service'
import { Arquetipo, Canal, type ConfigCliente } from '@shared/types/chatbot.types'

export const chatRouter = Router()

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { clienteId, usuarioId, texto } = req.body

    // TODO: validar que los tres campos existan
    // Si falta alguno → res.status(400).json({ error: '...' })
    if (!clienteId || !usuarioId || !texto) {
      return res.status(400).json({ error: 'Faltan campos' })
    }

    // TODO: buscar el cliente en DB
    // prisma.cliente.findUnique({ where: { id: clienteId } })
    // Si no existe → res.status(404).json({ error: '...' })

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }

    // TODO: armar el objeto ConfigCliente desde el cliente de DB
    // const config: ConfigCliente = { ... }
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

    // TODO: obtenerOCrearConversacion
    const conversacionId = await obtenerOCrearConversacion(config.id, usuarioId)
    // TODO: obtenerHistorial
    const historial = await obtenerHistorial(conversacionId)
    // TODO: guardarMensaje (user)
    await guardarMensaje(conversacionId, 'user', texto)
    // TODO: generarRespuesta
    const respuesta = await generarRespuesta(config, historial, texto)
    // TODO: guardarMensaje (assistant)
    await guardarMensaje(conversacionId, 'assistant', respuesta)
    // TODO: res.json({ respuesta })
    return res.json({ respuesta })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Error al generar respuesta' })
  }
})

chatRouter.post('/crear-cliente', async (req: Request, res: Response) => {
  try {
    const { nombre, systemPrompt } = req.body

    if (!nombre || !systemPrompt) {
      return res.status(400).json({ error: 'Faltan campos' })
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        systemPrompt,
      },
    })

    return res.json(cliente)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Error al crear cliente' })
  }
})

