// fase-1/ejercicios/src/scripts/test-ia.ts

import 'dotenv/config'
import { generarRespuesta } from '../services/ia.service'
import type { ConfigCliente, Mensaje } from '@shared/types/chatbot.types'
import { Arquetipo, Canal } from '@shared/types/chatbot.types'

// TODO 1: Definir una ConfigCliente de prueba para un restaurante
const configRestaurante: ConfigCliente = {
  id: 'cliente-prueba-1',
  nombre: 'La Parrilla de Mario',
  arquetipo: Arquetipo.FAQ,
  systemPrompt: `Sos el asistente virtual de "La Parrilla de Mario", un restaurante argentino.
Solo respondés preguntas sobre el menú, horarios y reservas.
Horario: martes a domingo de 12:00 a 15:00 y de 20:00 a 23:30.
Menú destacado: milanesa napolitana $8500, bife de chorizo $12000, empanadas $1500 c/u.
Sos amable, conciso y respondés en español rioplatense.`,
  modelo: 'gemini-2.5-flash',
  temperatura: 0.7,
  maxTokens: 512,
  maxHistorial: 10,
  canales: [Canal.WEB],
  activo: true,
  createdAt: new Date(),
}

// TODO 2: Historial vacío — primera vez que el usuario habla
const historial: Mensaje[] = []

// TODO 3: Llamar a generarRespuesta y mostrar el resultado
async function main() {
  console.log('Enviando mensaje a Gemini...\n')

  const respuesta = await generarRespuesta(
    configRestaurante,
    historial,
    '¿Qué días abren y hasta qué hora?'
  )

  console.log('Respuesta del bot:')
  console.log(respuesta)
}

main().catch(console.error)