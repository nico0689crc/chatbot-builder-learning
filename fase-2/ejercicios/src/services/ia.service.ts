import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import type { ConfigCliente, Mensaje } from '@shared/types/chatbot.types'

// TODO 4.2a: crear el modelo con config.modelo y config.temperatura
//   Pista: new ChatGoogleGenerativeAI({ model: ..., temperature: ... })
//   Problema: config llega por función, no es global — ¿dónde lo creás?
// const model = ???

// TODO 4.2b-d: armar el template con 3 partes
//   ["system", el system prompt dinámico],
//   MessagesPlaceholder para el historial,
//   ["human", el mensaje nuevo]
// const prompt = ChatPromptTemplate.fromMessages([
//   ???
// ])

// TODO 4.2e: chain con LCEL
//   prompt → model → StringOutputParser
// const chain = ???

export async function generarRespuesta(
  config: ConfigCliente,
  historial: Mensaje[],
  mensajeNuevo: string
): Promise<string> {
  // TODO 4.2a: crear el modelo con config.modelo y config.temperatura
  const model = new ChatGoogleGenerativeAI({
    model: config.modelo,
    temperature: config.temperatura,
  })

  // TODO 4.2b-d: armar el template con 3 partes
  //   ["system", el system prompt dinámico],
  //   MessagesPlaceholder para el historial,
  //   ["human", el mensaje nuevo]
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "{systemPrompt}"],
    new MessagesPlaceholder("historial"),
    ["human", "{input}"],
  ])

  // TODO 4.2e: chain con LCEL
  const chain = prompt.pipe(model).pipe(new StringOutputParser())

  // TODO 4.2f: convertir historial de Mensaje[] a HumanMessage/AIMessage[]
  //   Pista: m.rol === 'user' → new HumanMessage(m.contenido)
  //          m.rol === 'assistant' → new AIMessage(m.contenido)
  const mensajesHistorial = historial.map(m => {
    if (m.rol === 'user') {
      return new HumanMessage(m.contenido)
    }
    return new AIMessage(m.contenido)
  })

  // TODO 4.2g: invocar la chain con los valores para los slots del template
  //   Pista: chain.invoke({ systemPrompt: ..., historial: ..., input: ... })
  return chain.invoke({
    systemPrompt: config.systemPrompt,
    historial: mensajesHistorial,
    input: mensajeNuevo,
  })
}