import { Injectable } from '@nestjs/common';
import {
  StateGraph,
  END,
  START,
  MessagesAnnotation,
  Annotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import {
  FlowDefinition,
  NodeDefinition,
  NodeType,
  CampoDefinition,
  LlmCallConfig,
  ClassifierConfig,
  ConditionConfig,
  HttpRequestConfig,
  HumanHandoffConfig,
} from './graph-types';

@Injectable()
export class GraphInterpreterService {

  buildFromDefinition(
    flow: FlowDefinition,
    systemPrompt: string,
    tools: any[],
    checkpointer: PostgresSaver,
  ) {
    // 1. Construir el estado dinámico
    const GraphState = this.buildDynamicAnnotation(flow.campos);
    type State = typeof GraphState.State;

    // 2. Crear el StateGraph
    const graph = new StateGraph(GraphState);

    // 3. Registrar cada nodo según su tipo
    for (const node of flow.nodes) {
      const fn = this.buildNodeFunction<State>(node, systemPrompt, tools, flow);
      graph.addNode(node.nombre, fn as any);
    }

    // 4. Agrupar aristas por origen
    const edgesByOrigin = new Map<string, FlowDefinition['edges']>();
    for (const edge of flow.edges) {
      const group = edgesByOrigin.get(edge.origen) ?? [];
      group.push(edge);
      edgesByOrigin.set(edge.origen, group);
    }

    // 5. Agregar aristas al grafo
    for (const [origen, edges] of edgesByOrigin) {
      const hasConditional = edges.some(e => e.condicion !== null);
      const src = origen === '__start__' ? START : origen;

      if (!hasConditional) {
        for (const edge of edges) {
          const dest = edge.destino === '__end__' ? END : edge.destino;
          graph.addEdge(src as any, dest as any);
        }
      } else {
        // Construir mapa de routing: label -> nodo destino
        const routeMap: Record<string, string> = {};
        for (const edge of edges) {
          const label = edge.condicion!;
          const dest = edge.destino === '__end__' ? END : edge.destino;
          routeMap[label] = dest;
        }

        const originNode = flow.nodes.find(n => n.nombre === origen);
        const routingFn = this.buildRoutingFunction<State>(originNode, routeMap);

        graph.addConditionalEdges(src as any, routingFn as any, routeMap as any);
      }
    }

    return graph.compile({ checkpointer });
  }

  private buildDynamicAnnotation(campos: CampoDefinition[]) {
    const extraFields: Record<string, any> = {};

    for (const campo of campos) {
      const defaultVal = JSON.parse(campo.default);
      extraFields[campo.nombre] = Annotation<any>({
        reducer: campo.reducer === 'append'
          ? (a: any[], b: any) => [...(a ?? []), b]
          : (_: any, b: any) => b,
        default: () => defaultVal,
      });
    }

    return Annotation.Root({
      ...MessagesAnnotation.spec,
      ...extraFields,
    });
  }

  private buildNodeFunction<State>(
    node: NodeDefinition,
    systemPrompt: string,
    tools: any[],
    flow?: FlowDefinition,
  ) {
    switch (node.tipo as NodeType) {
      case 'llm_call': {
        // Solo bindear tools si este nodo tiene una arista hacia tool_executor
        const nodeTools =
          flow?.edges.some(e => e.origen === node.nombre && e.condicion === 'tools')
            ? tools
            : [];
        return this.makeLlmCallNode<State>(node, systemPrompt, nodeTools);
      }
      case 'tool_executor':
        return new ToolNode(tools);
      case 'classifier':
        return this.makeClassifierNode<State>(node, systemPrompt);
      case 'condition':
        return async (_state: State): Promise<Partial<State>> => ({} as Partial<State>);
      case 'http_request':
        return this.makeHttpRequestNode<State>(node);
      case 'human_handoff':
        return this.makeHandoffNode<State>(node, systemPrompt);
      default:
        throw new Error(`Tipo de nodo desconocido: ${node.tipo}`);
    }
  }

  private makeLlmCallNode<State>(node: NodeDefinition, systemPrompt: string, tools: any[]) {
    const config: LlmCallConfig = node.config;
    const modelName = config.modelName ?? 'gemini-2.5-flash';
    const baseModel = new ChatGoogleGenerativeAI({ model: modelName });

    // outputFields: structured output — el LLM responde con un objeto JSON
    // y cada key se escribe directamente al estado (no agrega messages)
    // Ejemplo config: { outputFields: { categoria: 'string', confianza: 'number' } }
    if (config.outputFields && Object.keys(config.outputFields).length > 0) {
      const schema = {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(config.outputFields).map(([k, tipo]) => [k, { type: tipo }]),
        ),
        required: Object.keys(config.outputFields),
      };
      console.log("**** Schema", schema);
      const structuredModel = baseModel.withStructuredOutput(schema as any);

      return async (state: State & { messages: any[] }): Promise<Partial<State>> => {
        const output = await structuredModel.invoke([
          new SystemMessage(systemPrompt),
          ...state.messages,
        ]);
        return output as unknown as Partial<State>;
      };
    }

    // Modo normal: devuelve el mensaje al historial (con tools si corresponde)
    const model = tools.length > 0 ? baseModel.bindTools(tools) : baseModel;

    return async (state: State & { messages: any[] }): Promise<Partial<State>> => {
      const result = await model.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
      ]);
      return { messages: [result] } as unknown as Partial<State>;
    };
  }

  private makeClassifierNode<State>(node: NodeDefinition, systemPrompt: string) {
    const config = node.config as unknown as ClassifierConfig;
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' });

    // Normalizar siempre a la forma multi-campo internamente
    const fieldDefs = config.fields ?? [
      { field: config.field ?? 'classification', categories: config.categories, prompt: config.prompt },
    ];

    return async (state: State & { messages: any[] }): Promise<Partial<State>> => {
      const lastMessage = state.messages[state.messages.length - 1];

      // Clasificar cada campo en paralelo
      const results = await Promise.all(
        fieldDefs.map(async (def) => {
          const classifyPrompt = `${def.prompt}\n\nCategorías disponibles: ${def.categories.join(', ')}\nResponde ÚNICAMENTE con el nombre de la categoría, sin texto adicional.`;
          const result = await model.invoke([new SystemMessage(classifyPrompt), lastMessage]);
          const raw = result.content;
          const text = Array.isArray(raw)
            ? raw.map(c => (typeof c === 'string' ? c : (c as any).text ?? '')).join('')
            : String(raw);
          const normalized = text.trim().toLowerCase();
          const matched = def.categories.find(cat => normalized.includes(cat.toLowerCase()));
          const value = matched ?? normalized.split(/\s+/).at(-1) ?? normalized;
          return { field: def.field, value };
        }),
      );

      const update: Record<string, string> = {};
      for (const { field, value } of results) update[field] = value;
      return update as unknown as Partial<State>;
    };
  }

  private makeHttpRequestNode<State>(node: NodeDefinition) {
    const config = node.config as unknown as HttpRequestConfig;

    return async (_state: State): Promise<Partial<State>> => {
      try {
        const response = await fetch(config.url, {
          method: config.method,
          headers: { 'Content-Type': 'application/json', ...(config.headers ?? {}) },
          body: config.method !== 'GET' ? config.bodyTemplate : undefined,
        });
        const data = await response.json();

        // fieldMap: extraer múltiples campos con dot-path
        // Ejemplo: { turno_id: 'data.id', estado: 'data.status' }
        if (config.fieldMap && Object.keys(config.fieldMap).length > 0) {
          const update: Record<string, unknown> = {};
          for (const [stateField, dotPath] of Object.entries(config.fieldMap)) {
            update[stateField] = dotPath.split('.').reduce<unknown>((obj, key) =>
              obj != null && typeof obj === 'object' ? (obj as any)[key] : undefined, data,
            );
          }
          return update as unknown as Partial<State>;
        }

        // Compatibilidad hacia atrás: un solo campo
        const resultField = config.resultField ?? 'httpResult';
        return { [resultField]: data } as unknown as Partial<State>;
      } catch (err) {
        const fallbackField = config.resultField ?? Object.keys(config.fieldMap ?? {})[0] ?? 'httpResult';
        return { [fallbackField]: { error: String(err) } } as unknown as Partial<State>;
      }
    };
  }

  private makeHandoffNode<State>(node: NodeDefinition, systemPrompt: string) {
    const config = node.config as unknown as HumanHandoffConfig;
    const escalatedField = config.escalatedField ?? 'escalated';
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' });

    return async (state: State & { messages: any[] }): Promise<Partial<State>> => {
      const result = await model.invoke([
        new SystemMessage(config.message),
        ...state.messages,
      ]);
      return {
        messages: [result],
        [escalatedField]: true,
      } as unknown as Partial<State>;
    };
  }

  private buildRoutingFunction<State>(
    originNode: NodeDefinition | undefined,
    routeMap: Record<string, string>,
  ) {
    const originType = originNode?.tipo as NodeType | undefined;
    const originConfig = originNode?.config ?? {};

    return (state: State & { messages: any[] }): string => {
      if (originType === 'llm_call' || originType === 'tool_executor') {
        const last = state.messages[state.messages.length - 1] as AIMessage;
        const hasCalls = (last.tool_calls?.length ?? 0) > 0;
        if (hasCalls && routeMap['tools']) return 'tools';
        return '__end__';
      }

      if (originType === 'classifier' || originType === 'condition') {
        const config = originConfig as unknown as ConditionConfig | ClassifierConfig;
        const field = 'field' in config ? (config as ConditionConfig).field : 'classification';
        const val = (state as any)[field] ?? '';
        const fallback = 'default' in config ? (config as ConditionConfig).default : Object.keys(routeMap)[0];
        return routeMap[val] ? val : fallback;
      }

      return Object.keys(routeMap)[0];
    };
  }
}
