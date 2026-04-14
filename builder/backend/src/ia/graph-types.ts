export type NodeType =
  | 'llm_call'
  | 'tool_executor'
  | 'classifier'
  | 'condition'
  | 'http_request'
  | 'human_handoff';

export type ReducerType = 'last_wins' | 'append';

export interface CampoDefinition {
  nombre: string;
  tipo: string;
  reducer: ReducerType;
  default: string; // JSON string
}

export interface NodeDefinition {
  nombre: string;
  tipo: NodeType;
  config: Record<string, unknown>;
}

export interface EdgeDefinition {
  origen: string;
  destino: string;
  condicion: string | null;
}

export interface FlowDefinition {
  id: string;
  clienteId: string;
  campos: CampoDefinition[];
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}

// Config shapes por tipo de nodo
export interface LlmCallConfig {
  modelName?: string;
  // Si se define, el LLM responde con structured output y cada key se escribe al estado.
  // Ejemplo: { categoria: 'string', confianza: 'number' }
  outputFields?: Record<string, 'string' | 'number' | 'boolean'>;
}

export interface ClassifierConfig {
  categories: string[];
  prompt: string;
  // Un solo campo (compatibilidad hacia atrás)
  field?: string;
  // Múltiples campos: cada uno se clasifica de forma independiente con su propio prompt/categories
  fields?: Array<{
    field: string;
    categories: string[];
    prompt: string;
  }>;
}

export interface ConditionConfig {
  field: string;
  mapping: Record<string, string>;
  default: string;
}

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  // Un solo campo (compatibilidad hacia atrás)
  resultField?: string;
  // Múltiples campos: dot-path sobre la respuesta -> campo del estado
  // Ejemplo: { turno_id: 'data.id', estado: 'data.status' }
  fieldMap?: Record<string, string>;
}

export interface HumanHandoffConfig {
  message: string;
  escalatedField?: string;
}
