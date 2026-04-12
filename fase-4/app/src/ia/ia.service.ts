import { Injectable } from '@nestjs/common';
import { StateGraph, END, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage } from '@langchain/core/messages';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

type Arquetipo = 'faq' | 'soporte';

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
});
type State = typeof GraphState.State;

@Injectable()
export class IAService {
  private checkpointer: PostgresSaver;

  constructor() {
    this.checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  }

  async onModuleInit() {
    await this.checkpointer.setup();
  }

  buildGraph(arquetipo: Arquetipo, systemPrompt: string) {
    switch (arquetipo) {
      case 'faq':     return this.buildFaqGraph(systemPrompt);
      case 'soporte': return this.buildSoporteGraph(systemPrompt);
      default:        throw new Error(`Arquetipo desconocido: ${arquetipo}`);
    }
  }

  private buildFaqGraph(systemPrompt: string) {
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' });

    const callModel = async (state: State): Promise<Partial<State>> => {
      const result = await model.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
      ]);
      return { messages: [result] };
    };

    return new StateGraph(GraphState)
      .addNode('model', callModel)
      .addEdge('__start__', 'model')
      .addEdge('model', '__end__')
      .compile({ checkpointer: this.checkpointer });
  }

  private buildSoporteGraph(systemPrompt: string) {
    // En Sesión 11 se integran tools desde la DB.
    // Por ahora mismo grafo que FAQ pero con el system prompt de soporte.
    return this.buildFaqGraph(systemPrompt);
  }

  getCheckpointer() {
    return this.checkpointer;
  }
}
