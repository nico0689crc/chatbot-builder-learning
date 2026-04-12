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
