import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, END, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ToolExecutorService } from './tool-executor.service';

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
});
type State = typeof GraphState.State;

@Injectable()
export class IAService implements OnModuleInit {
  private checkpointer: PostgresSaver;

  constructor(private toolExecutor: ToolExecutorService) {
    this.checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  }

  async onModuleInit() {
    await this.checkpointer.setup();
  }

  /**
   * Construye el grafo correcto según el arquetipo del cliente.
   * Si el cliente tiene tools en la DB, las carga y las inyecta en el grafo.
   */
  async buildGraph(arquetipo: string, systemPrompt: string, clienteId: string) {
    const tools = await this.toolExecutor.loadToolsForCliente(clienteId);

    switch (arquetipo) {
      case 'faq':
        return this.buildFaqGraph(systemPrompt);
      case 'soporte':
      case 'turnos':
      case 'ventas':
        return tools.length > 0
          ? this.buildGraphWithTools(systemPrompt, tools)
          : this.buildFaqGraph(systemPrompt);
      default:
        return this.buildFaqGraph(systemPrompt);
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

  private buildGraphWithTools(systemPrompt: string, tools: any[]) {
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' }).bindTools(tools);
    const toolNode = new ToolNode(tools);

    const callModel = async (state: State): Promise<Partial<State>> => {
      const result = await model.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
      ]);
      return { messages: [result] };
    };

    const routeAfterModel = (state: State): 'tools' | '__end__' => {
      const last = state.messages[state.messages.length - 1] as AIMessage;
      return (last.tool_calls?.length ?? 0) > 0 ? 'tools' : '__end__';
    };

    return new StateGraph(GraphState)
      .addNode('model', callModel)
      .addNode('tools', toolNode)
      .addEdge('__start__', 'model')
      .addConditionalEdges('model', routeAfterModel, { tools: 'tools', __end__: END })
      .addEdge('tools', 'model')
      .compile({ checkpointer: this.checkpointer });
  }
}
