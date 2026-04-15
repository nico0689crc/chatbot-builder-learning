import { notFound } from "next/navigation"
import { api, Arquetipo } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

// ── Metadata por arquetipo ──────────────────────────────────────────────────

interface ArquetipoInfo {
  label: string
  descripcion: string
  queMostrar: string
  sugerencias: string[]
  color: string
}

const ARQUETIPOS: Record<Arquetipo, ArquetipoInfo> = {
  faq: {
    label: "Arquetipo 1 — FAQ & Info",
    descripcion:
      "El bot más simple y el más frecuente. Responde preguntas frecuentes directamente desde su configuración, sin consultar ningún sistema externo. Ideal cuando el problema es disponibilidad horaria y alto volumen de consultas repetidas.",
    queMostrar:
      "Observá cómo el bot responde preguntas sobre horarios, precios y servicios sin necesidad de tools ni APIs externas. Toda la información vive en el system prompt.",
    sugerencias: [
      "¿A qué hora cierran esta noche?",
      "¿Cuánto sale el bife de chorizo?",
      "¿Tienen delivery?",
      "Quiero reservar una mesa para el sábado",
    ],
    color: "#b45309",
  },
  turnos: {
    label: "Arquetipo 2 — Agenda & Turnos",
    descripcion:
      "El bot consulta disponibilidad en tiempo real y reserva turnos directamente en el sistema. Usa function calling para leer y escribir datos — nunca inventa horarios ni confirmaciones.",
    queMostrar:
      "Probá pedir un turno para una especialidad concreta. El bot va a consultar la disponibilidad real, mostrarte opciones y confirmar la reserva. También podés preguntar por especialidades o médicos disponibles.",
    sugerencias: [
      "¿Qué especialidades tienen?",
      "Quiero un turno con cardiología para mañana",
      "¿Hay turnos de pediatría esta semana?",
      "Me duele mucho el pecho (urgencia)",
    ],
    color: "#0ea5e9",
  },
  ventas: {
    label: "Arquetipo 3 — Ventas & Captación",
    descripcion:
      "El bot actúa como vendedor consultivo: entiende la necesidad del usuario, filtra opciones relevantes según su perfil y captura los datos de contacto para el equipo comercial. Temperatura más alta para un tono persuasivo pero no invasivo.",
    queMostrar:
      "El bot va a hacerte preguntas para entender qué buscás antes de mostrarte propiedades. Observá cómo califica la conversación y cómo registra el lead cuando mostrás interés real.",
    sugerencias: [
      "Busco un departamento en Nueva Córdoba",
      "Necesito algo hasta $120.000, 2 ambientes",
      "¿Tienen casas en Argüello con jardín?",
      "Me interesa, quiero que me contacten",
    ],
    color: "#1d4ed8",
  },
  soporte: {
    label: "Arquetipo 4 — Soporte & Postventa",
    descripcion:
      "El bot accede a múltiples sistemas para resolver problemas: consulta el estado del pedido, inicia devoluciones y escala con contexto completo cuando no puede resolver. Si el usuario tiene que repetir su problema, el bot falló.",
    queMostrar:
      "Consultá el estado de un pedido usando el número TM-00123 o TM-00124. Probá también iniciar una devolución o plantear un reclamo para ver cómo escala al soporte humano.",
    sugerencias: [
      "¿Dónde está mi pedido TM-00123?",
      "Quiero devolver el pedido TM-00124, llegó roto",
      "Me cobraron dos veces el mismo pedido",
      "¿Cuándo llega mi compra?",
    ],
    color: "#16a34a",
  },
  interno: {
    label: "Arquetipo 5 — Asistente Interno",
    descripcion:
      "El usuario es un empleado, no un cliente final. El bot centraliza el conocimiento organizacional — políticas, procedimientos, documentos — y responde citando la fuente. Si no encuentra respuesta, registra la consulta para que el área responsable la responda.",
    queMostrar:
      "Preguntá sobre políticas de vacaciones, licencias o gastos. Probá también consultar un procedimiento como el onboarding. Si hacés una pregunta que no tiene respuesta en la base, el bot la va a registrar.",
    sugerencias: [
      "¿Cuántos días de vacaciones tenemos?",
      "¿Cómo pido una notebook nueva?",
      "¿Cuál es la política de home office?",
      "¿Hay política sobre uso de IA en el trabajo?",
    ],
    color: "#7c3aed",
  },
  transaccional: {
    label: "Arquetipo 6 — Transaccional",
    descripcion:
      "El más complejo. El bot no solo consulta — ejecuta acciones reales: transfiere dinero, actualiza saldos, genera comprobantes. Primero verifica tu identidad con PIN y siempre pide confirmación explícita antes de ejecutar cualquier operación.",
    queMostrar:
      "El bot te va a pedir tu ID y PIN antes de mostrarte cualquier dato. Usuarios de prueba: mario.garcia / 1234 y ana.lopez / 5678. Probá consultar el saldo y luego hacer una transferencia — observá cómo muestra el preview antes de ejecutar.",
    sugerencias: [
      "Quiero ver mi saldo",
      "Mostrame los últimos movimientos",
      "Quiero transferirle $5000 a ana.lopez",
      "Dame el comprobante de la última operación",
    ],
    color: "#0891b2",
  },
}

// ── Página ──────────────────────────────────────────────────────────────────

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  console.log('slug', slug)

  let cliente
  try {
    cliente = await api.clientes.getBySlug(slug)
  } catch {
    notFound()
  }

  const info = ARQUETIPOS[cliente.arquetipo as Arquetipo]

  return (
    <div style={{
      margin: 0,
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#f1f5f9",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ maxWidth: "560px", width: "100%" }}>

        {/* Badge arquetipo */}
        <div style={{ marginBottom: "16px" }}>
          <span style={{
            display: "inline-block",
            background: info?.color ?? "#64748b",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: "4px 12px",
            borderRadius: "999px",
          }}>
            {info?.label ?? cliente.arquetipo.toUpperCase()}
          </span>
        </div>

        {/* Card principal */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06)",
          marginBottom: "16px",
        }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            {cliente.nombre}
          </h1>

          {info && (
            <>
              <p style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
                {info.descripcion}
              </p>

              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Qué observar en esta demo
                </p>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "#64748b" }}>
                  {info.queMostrar}
                </p>
              </div>

              <div>
                <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Mensajes de prueba
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {info.sugerencias.map((s, i) => (
                    <div key={i} style={{
                      fontSize: "13px",
                      color: "#475569",
                      background: "#f1f5f9",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}>
                      "{s}"
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Instrucción widget */}
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", margin: 0 }}>
          Hacé click en el botón 💬 para chatear con {cliente.widgetNombre || cliente.nombre}
        </p>
      </div>

      <script
        src={`${API_URL}/public/widget.js`}
        data-client-id={cliente.id}
        data-api-url={API_URL}
      />
    </div>
  )
}
