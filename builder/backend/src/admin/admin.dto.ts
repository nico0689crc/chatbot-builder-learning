export class CrearClienteDto {
  nombre: string;
  arquetipo: string; // "faq" | "soporte" | "turnos" | "ventas"
  systemPrompt: string;
}

export class CrearToolDto {
  nombre: string;
  descripcion: string;
  tipo: string;    // "API_REST" | "GOOGLE_SHEETS"
  url: string;
  metodo?: string; // "GET" | "POST" | "PUT" — default GET
  headers?: Record<string, string>;
}

export class CrearParametroDto {
  nombre: string;
  tipo: string;        // "string" | "number" | "boolean"
  descripcion: string;
  requerido?: boolean; // default true
}

export class ActualizarWidgetDto {
  widgetNombre?: string;
  widgetColor?: string;
  widgetBienvenida?: string;
}

export class ActualizarSystemPromptDto {
  systemPrompt: string;
}

export class ActualizarToolDto {
  descripcion?: string;
  activa?: boolean;
  url?: string;
  metodo?: string;
  headers?: Record<string, string>;
}

export class CrearFlujoDto {
  nombre: string;
  descripcion?: string;
}

export class CrearCampoDto {
  nombre: string;
  tipo: string;      // "string" | "number" | "boolean" | "object" | "array"
  reducer: string;   // "last_wins" | "append"
  default?: string;  // JSON string, default "null"
}

export class CrearNodoDto {
  nombre: string;
  tipo: string;                      // NodeType
  config?: Record<string, unknown>;
  orden?: number;
}

export class ActualizarNodoDto {
  tipo?: string;
  config?: Record<string, unknown>;
  orden?: number;
}

export class ActualizarCampoDto {
  tipo?: string;
  reducer?: string;
  default?: string;
}

export class CrearAristaDto {
  origen: string;    // nombre del nodo o "__start__"
  destino: string;   // nombre del nodo o "__end__"
  condicion?: string;
}

export class ActualizarAristaDto {
  origen?: string;
  destino?: string;
  condicion?: string | null;
}
