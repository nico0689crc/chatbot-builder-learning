import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ConfigCliente, Mensaje } from '@shared/types/chatbot.types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

export async function generarRespuesta(
  config: ConfigCliente,
  historial: Mensaje[],
  mensajeNuevo: string
): Promise<string> {

  // El system prompt va en el modelo, no en los mensajes
  const model = genAI.getGenerativeModel({
    model: config.modelo,
    systemInstruction: config.systemPrompt,
  })

  // Gemini usa 'model' en lugar de 'assistant' para las respuestas del bot
  const history = historial.map(m => ({
    role: m.rol === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.contenido }],
  }))

  // Abrimos una sesión de chat con el historial previo
  const chat = model.startChat({ history })

  // Mandamos el mensaje nuevo — Gemini agrega user + model automáticamente
  const result = await chat.sendMessage(mensajeNuevo)

  return result.response.text()
}
