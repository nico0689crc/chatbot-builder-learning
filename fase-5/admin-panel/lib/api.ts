const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  console.log(`${BASE_URL}${path}`)
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
  },

  tools: {
    list: (clienteId: string) => request<Tool[]>(`/admin/clientes/${clienteId}/tools`),
    create: (clienteId: string, data: CrearToolPayload) =>
      request<Tool>(`/admin/clientes/${clienteId}/tools`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    addParametro: (clienteId: string, toolId: string, data: CrearParametroPayload) =>
      request<Parametro>(`/admin/clientes/${clienteId}/tools/${toolId}/parametros`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  metricas: {
    get: (clienteId: string, periodo?: string) => {
      const qs = periodo ? `?periodo=${periodo}` : ""
      return request<Metricas>(`/admin/clientes/${clienteId}/metricas${qs}`)
    },
  },
}
