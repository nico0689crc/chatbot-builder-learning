// shared/types/chatbot.types.ts
// Tipos del dominio compartidos entre todas las fases del proyecto.
// Estos tipos reflejan exactamente el modelo de datos del builder multi-tenant.

// ─────────────────────────────────────────────
// ARQUETIPOS
// ─────────────────────────────────────────────

/**
 * Los 6 tipos de bot que el builder soporta.
 * Cada arquetipo tiene su propio grafo LangGraph,
 * su propio conjunto de tools y sus propios parámetros de IA.
 */
export enum Arquetipo {
  FAQ          = 'faq',          // Responde preguntas con info estática — sin tools
  TURNOS       = 'turnos',       // Gestiona agenda y reservas — tools de lectura/escritura
  VENTAS       = 'ventas',       // Califica leads y captura contactos — tools de CRM
  SOPORTE      = 'soporte',      // Resuelve reclamos y consulta pedidos — tools múltiples
  INTERNO      = 'interno',      // Asistente para empleados — RAG + búsqueda en docs
  TRANSACCIONAL = 'transaccional', // Ejecuta acciones en sistemas — tools con escritura crítica
}

// ─────────────────────────────────────────────
// CANALES
// ─────────────────────────────────────────────

/** Los canales por donde el usuario puede contactar al bot */
export enum Canal {
  WEB        = 'web',        // Widget embebido en el sitio del cliente
  WHATSAPP   = 'whatsapp',  // Twilio o Meta API
  INSTAGRAM  = 'instagram', // Meta API (futuro)
  API        = 'api',       // Integración directa con sistema del cliente
}

// ─────────────────────────────────────────────
// MENSAJES Y CONVERSACIONES
// ─────────────────────────────────────────────

/** Quién escribió el mensaje — la IA espera que se alternen */
export type RolMensaje = 'user' | 'assistant'

/** Un mensaje dentro de una conversación */
export interface Mensaje {
  id:             string
  conversacionId: string
  rol:            RolMensaje
  contenido:      string
  timestamp:      Date
}

/**
 * Una sesión de chat entre un usuario y el bot.
 * Un usuario puede tener múltiples conversaciones con el mismo bot.
 * La conversación activa es la que se usa para acumular historial.
 */
export interface Conversacion {
  id:        string
  clienteId: string   // qué bot — el multi-tenant key
  usuarioId: string   // quién está chateando
  canal:     Canal
  estado:    'activa' | 'cerrada' | 'escalada'
  createdAt: Date
  updatedAt: Date
  mensajes?: Mensaje[]
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN DEL CLIENTE
// ─────────────────────────────────────────────

/**
 * La configuración completa de un cliente (negocio).
 * Todo lo que define el comportamiento del bot de ese cliente.
 * Se guarda en la DB y se carga al inicio de cada conversación.
 *
 * Este es el corazón del multi-tenant:
 * el mismo motor usa distintas ConfigCliente para distintos negocios.
 */
export interface ConfigCliente {
  id:           string
  nombre:       string
  arquetipo:    Arquetipo

  // Parámetros de IA — las 9 variables del diseño
  systemPrompt: string    // personalidad, reglas, conocimiento del negocio
  modelo:       string    // 'claude-haiku-20240307' | 'claude-sonnet-4-5' | etc.
  temperatura:  number    // 0.0 (estricto) → 1.0 (creativo)
  maxTokens:    number    // límite de largo de respuesta
  maxHistorial: number    // cuántos turnos previos se envían a la IA

  // Canales habilitados para este cliente
  canales:      Canal[]

  // Estado
  activo:       boolean
  createdAt:    Date
}

// ─────────────────────────────────────────────
// FUNCTION CALLING — TOOLS
// ─────────────────────────────────────────────

/** Los tipos de conector que el executor universal puede resolver */
export enum TipoConector {
  API_REST      = 'api_rest',       // HTTP GET/POST al sistema del cliente
  GOOGLE_SHEETS = 'google_sheets',  // Lectura de planillas del cliente
  BD_DIRECTA    = 'bd_directa',     // Query a PostgreSQL/MySQL del cliente
  WEBHOOK       = 'webhook',        // Notificación saliente (Make, Zapier, etc.)
  CRM           = 'crm',            // HubSpot, Salesforce, Pipedrive
}

/** Configuración de una herramienta habilitada para un cliente */
export interface ConfigTool {
  id:          string
  clienteId:   string
  nombre:      string       // identificador único, ej: 'verificar_disponibilidad'
  descripcion: string       // para la IA — cuándo usar esta tool
  habilitada:  boolean
  conector:    ConfigConector
  parametros:  ConfigParametro[]
}

/** Cómo conectarse a la fuente de datos de la tool */
export interface ConfigConector {
  id:           string
  toolId:       string
  tipo:         TipoConector
  url?:         string      // para API_REST y WEBHOOK
  credenciales?: Record<string, string>  // se guardan cifradas
  mapeo?:       Record<string, string>  // mapeo de campos si es necesario
}

/** Un parámetro que la IA puede extraer del mensaje y pasar a la tool */
export interface ConfigParametro {
  id:          string
  toolId:      string
  nombre:      string       // nombre del parámetro en la función
  tipo:        'string' | 'number' | 'boolean' | 'date'
  requerido:   boolean
  descripcion: string       // para la IA — qué extraer del mensaje del usuario
}

// ─────────────────────────────────────────────
// ESCALADO
// ─────────────────────────────────────────────

/** Razones por las que el bot puede escalar a un humano */
export enum MotivoEscalado {
  NO_SABE_RESPONDER    = 'no_sabe_responder',
  USUARIO_LO_PIDE      = 'usuario_lo_pide',
  TEMA_SENSIBLE        = 'tema_sensible',
  QUEJA_FORMAL         = 'queja_formal',
  ERROR_SISTEMA        = 'error_sistema',
  SUPERA_COMPLEJIDAD   = 'supera_complejidad',
}

/** Evento de escalado — cuando el bot no puede resolver */
export interface EventoEscalado {
  conversacionId: string
  clienteId:      string
  motivo:         MotivoEscalado
  resumen:        string        // contexto para el agente humano
  timestamp:      Date
  atendido:       boolean
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────

/** Métricas mensuales de un cliente — lo que muestra el reporte */
export interface MetricasCliente {
  clienteId:              string
  periodo:                string    // 'YYYY-MM'
  totalConversaciones:    number
  resueltosSinEscalado:   number    // tasa de resolución autónoma
  escalados:              number
  fueraDeHorario:         number    // resueltos fuera del horario del negocio
  tiempoPromedioRespuesta: number   // en milisegundos
  topPreguntas:           string[]  // las más frecuentes del período
}

// ─────────────────────────────────────────────
// REQUESTS Y RESPONSES DEL API
// ─────────────────────────────────────────────

/** Body del endpoint POST /chat */
export interface ChatRequest {
  clienteId: string
  usuarioId: string
  texto:     string
  canal?:    Canal
}

/** Response del endpoint POST /chat */
export interface ChatResponse {
  respuesta:      string
  conversacionId: string
  escalado?:      boolean
  motivoEscalado?: MotivoEscalado
}
