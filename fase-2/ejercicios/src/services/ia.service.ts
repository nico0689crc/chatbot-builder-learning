import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { ConfigCliente, Mensaje } from '@shared/types/chatbot.types'
import { crearTurnosTools } from './tools/turnos.tools'

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "{systemPrompt}"],
  new MessagesPlaceholder("historial"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad")
])

export async function generarRespuesta(
  config: ConfigCliente,
  historial: Mensaje[],
  mensajeNuevo: string,
  usuarioId: string = 'anonimo'
): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    model: config.modelo,
    temperature: config.temperatura,
  })

  const tools = crearTurnosTools(config.id, usuarioId)

  const agent = createToolCallingAgent({ llm: model, tools, prompt })
  const executor = new AgentExecutor({ agent, tools })

  const mensajesHistorial = historial.map((h) => h.rol === 'user' ?
    new HumanMessage(h.contenido) :
    new AIMessage(h.contenido)
  )

  // TODO 5.2c: invocar el executor — ojo, devuelve { output: string }, no string directo
  const resultado = await executor.invoke({
    systemPrompt: config.systemPrompt,
    historial: mensajesHistorial,
    input: mensajeNuevo
  })

  return resultado.output
}