const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

// --- Types ---

export type Arquetipo = "faq" | "soporte" | "turnos" | "ventas" | "transaccional" | "interno"

export interface Cliente {
  id: string
  nombre: string
  arquetipo: Arquetipo
  systemPrompt: string
  activo: boolean
  creadoEn: string
  widgetNombre: string
  widgetColor: string
  widgetBienvenida: string
}

export interface ActualizarWidgetPayload {
  widgetNombre?: string
  widgetColor?: string
  widgetBienvenida?: string
}

export interface Tool {
  id: string
  clienteId: string
  nombre: string
  descripcion: string
  activa: boolean
  creadoEn: string
  parametros: Parametro[]
  conector: Conector | null
}

export interface Parametro {
  id: string
  nombre: string
  tipo: string
  descripcion: string
  requerido: boolean
}

export interface Conector {
  id: string
  tipo: string
  url: string
  metodo: string
  headers: Record<string, string>
}

// --- Flujo ---

export type TipoNodo = "llm_call" | "tool_executor" | "classifier" | "condition" | "http_request" | "human_handoff"
export type TipoCampo = "string" | "number" | "boolean" | "object" | "array"
export type ReducerCampo = "last_wins" | "append"

export interface CampoDef {
  id: string
  flujoId: string
  nombre: string
  tipo: TipoCampo
  reducer: ReducerCampo
  default: string
}

export interface NodoDef {
  id: string
  flujoId: string
  nombre: string
  tipo: TipoNodo
  config: Record<string, unknown>
  orden: number
}

export interface AristaDef {
  id: string
  flujoId: string
  origen: string
  destino: string
  condicion: string | null
}

export interface FlujoDef {
  id: string
  clienteId: string
  nombre: string
  descripcion: string
  activo: boolean
  creadoEn: string
  actualizadoEn: string
  campos: CampoDef[]
  nodos: NodoDef[]
  aristas: AristaDef[]
}

export interface CrearFlujoPayload {
  nombre: string
  descripcion?: string
}

export interface CrearNodoPayload {
  nombre: string
  tipo: TipoNodo
  config?: Record<string, unknown>
  orden?: number
}

export interface CrearAristaPayload {
  origen: string
  destino: string
  condicion?: string
}

export interface ActualizarAristaPayload {
  origen?: string
  destino?: string
  condicion?: string | null
}

export interface CrearCampoPayload {
  nombre: string
  tipo: TipoCampo
  reducer: ReducerCampo
  default?: string
}

export interface ActualizarNodoPayload {
  tipo?: TipoNodo
  config?: Record<string, unknown>
  orden?: number
}

export interface ActualizarCampoPayload {
  tipo?: TipoCampo
  reducer?: ReducerCampo
  default?: string
}

export interface Metricas {
  cliente: { id: string; nombre: string }
  periodo: string
  conversacionesTotales: number
  mensajesTotales: number
  tasaResolucionPct: number
  duracionPromedioMin: number
  consultasFrecuentes: { tema: string; count: number }[]
  conversacionesPorDia: { dia: string; total: number }[]
}

export interface CrearClientePayload {
  nombre: string
  arquetipo: Arquetipo
  systemPrompt: string
}

export interface CrearToolPayload {
  nombre: string
  descripcion: string
  tipo: string
  url: string
  metodo?: string
  headers?: Record<string, string>
}

export interface ActualizarToolPayload {
  descripcion?: string
  activa?: boolean
  url?: string
  metodo?: string
  headers?: Record<string, string>
}

export interface CrearParametroPayload {
  nombre: string
  tipo: string
  descripcion: string
  requerido?: boolean
}

// --- Clientes ---

export const api = {
  clientes: {
    list: () => request<Cliente[]>("/admin/clientes"),
    get: (id: string) => request<Cliente>(`/admin/clientes/${id}`),
    create: (data: CrearClientePayload) =>
      request<Cliente>("/admin/clientes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateWidget: (id: string, data: ActualizarWidgetPayload) =>
      request<Pick<Cliente, "id" | "widgetNombre" | "widgetColor" | "widgetBienvenida">>(
        `/admin/clientes/${id}/widget`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    updateSystemPrompt: (id: string, systemPrompt: string) =>
      request<Pick<Cliente, "id" | "systemPrompt">>(
        `/admin/clientes/${id}/system-prompt`,
        { method: "PATCH", body: JSON.stringify({ systemPrompt }) }
      ),
  },

  tools: {
    list: (clienteId: string) => request<Tool[]>(`/admin/clientes/${clienteId}/tools`),
    get: (clienteId: string, toolId: string) =>
      request<Tool>(`/admin/clientes/${clienteId}/tools/${toolId}`),
    create: (clienteId: string, data: CrearToolPayload) =>
      request<Tool>(`/admin/clientes/${clienteId}/tools`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (clienteId: string, toolId: string, data: ActualizarToolPayload) =>
      request<Tool>(`/admin/clientes/${clienteId}/tools/${toolId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    addParametro: (clienteId: string, toolId: string, data: CrearParametroPayload) =>
      request<Parametro>(`/admin/clientes/${clienteId}/tools/${toolId}/parametros`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteParametro: (clienteId: string, toolId: string, parametroId: string) =>
      request<{ deleted: boolean }>(
        `/admin/clientes/${clienteId}/tools/${toolId}/parametros/${parametroId}`,
        { method: "DELETE" }
      ),
  },

  flujo: {
    get: (clienteId: string) => request<FlujoDef>(`/admin/clientes/${clienteId}/flujo`),
    create: (clienteId: string, data: CrearFlujoPayload) =>
      request<FlujoDef>(`/admin/clientes/${clienteId}/flujo`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (clienteId: string) =>
      request<{ deleted: boolean }>(`/admin/clientes/${clienteId}/flujo`, { method: "DELETE" }),

    addNodo: (clienteId: string, data: CrearNodoPayload) =>
      request<NodoDef>(`/admin/clientes/${clienteId}/flujo/nodos`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateNodo: (clienteId: string, nombre: string, data: ActualizarNodoPayload) =>
      request<NodoDef>(`/admin/clientes/${clienteId}/flujo/nodos/${nombre}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteNodo: (clienteId: string, nombre: string) =>
      request<{ deleted: boolean }>(`/admin/clientes/${clienteId}/flujo/nodos/${nombre}`, {
        method: "DELETE",
      }),

    addArista: (clienteId: string, data: CrearAristaPayload) =>
      request<AristaDef>(`/admin/clientes/${clienteId}/flujo/aristas`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateArista: (clienteId: string, aristaId: string, data: ActualizarAristaPayload) =>
      request<AristaDef>(`/admin/clientes/${clienteId}/flujo/aristas/${aristaId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteArista: (clienteId: string, aristaId: string) =>
      request<{ deleted: boolean }>(`/admin/clientes/${clienteId}/flujo/aristas/${aristaId}`, {
        method: "DELETE",
      }),

    addCampo: (clienteId: string, data: CrearCampoPayload) =>
      request<CampoDef>(`/admin/clientes/${clienteId}/flujo/campos`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCampo: (clienteId: string, nombre: string, data: ActualizarCampoPayload) =>
      request<CampoDef>(`/admin/clientes/${clienteId}/flujo/campos/${nombre}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteCampo: (clienteId: string, nombre: string) =>
      request<{ deleted: boolean }>(`/admin/clientes/${clienteId}/flujo/campos/${nombre}`, {
        method: "DELETE",
      }),

    getMermaid: (clienteId: string) =>
      request<{ diagram: string }>(`/admin/clientes/${clienteId}/flujo/mermaid`),
  },

  metricas: {
    get: (clienteId: string, periodo?: string) => {
      const qs = periodo ? `?periodo=${periodo}` : ""
      return request<Metricas>(`/admin/clientes/${clienteId}/metricas${qs}`)
    },
  },
}
