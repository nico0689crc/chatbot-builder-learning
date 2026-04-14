import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  nombre: string
  precio_mensual: number
  limite_usuarios: number | null
  soporte_prioritario: boolean
  sla_horas: number
}

interface Usuario {
  id: string
  nombre: string
  email: string
  empresa: string | null
  plan_id: string
  activo: boolean
  creado_en: string
  planes: Plan
}

interface Ticket {
  id: string
  usuario_id: string
  titulo: string
  descripcion: string
  categoria: string
  prioridad: string
  estado: string
  creado_en: string
  actualizado_en: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(res: express.Response, status: number, message: string) {
  return res.status(status).json({ error: message })
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

// GET /usuarios/by-email?email=xxx  — identificar usuario por email
app.get('/usuarios/by-email', async (req, res) => {
  const email = req.query.email as string
  if (!email) return err(res, 400, 'Se requiere el parámetro email')

  const { data, error } = await supabase
    .from('usuarios')
    .select('*, planes(*)')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) return err(res, 404, `No se encontró usuario con email ${email}`)

  const u = data as Usuario
  return res.json({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    empresa: u.empresa,
    activo: u.activo,
    plan: {
      id: u.planes.id,
      nombre: u.planes.nombre,
      precio_mensual: u.planes.precio_mensual,
      limite_usuarios: u.planes.limite_usuarios,
      soporte_prioritario: u.planes.soporte_prioritario,
      sla_horas: u.planes.sla_horas,
    },
    cliente_desde: u.creado_en,
  })
})

// GET /usuarios?id=xxx  — info del usuario por ID
app.get('/usuarios', async (req, res) => {
  const id = req.query.id as string
  if (!id) return err(res, 400, 'Se requiere el parámetro id')

  const { data, error } = await supabase
    .from('usuarios')
    .select('*, planes(*)')
    .eq('id', id)
    .single()

  if (error || !data) return err(res, 404, `Usuario ${id} no encontrado`)

  const u = data as Usuario
  return res.json({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    empresa: u.empresa,
    activo: u.activo,
    plan: {
      id: u.planes.id,
      nombre: u.planes.nombre,
      precio_mensual: u.planes.precio_mensual,
      limite_usuarios: u.planes.limite_usuarios,
      soporte_prioritario: u.planes.soporte_prioritario,
      sla_horas: u.planes.sla_horas,
    },
    cliente_desde: u.creado_en,
  })
})

// GET /tickets?usuario_id=xxx  — tickets del usuario (últimos 10)
// GET /tickets?id=xxx          — detalle de un ticket específico
app.get('/tickets', async (req, res) => {
  const { id, usuario_id } = req.query as Record<string, string>

  if (id) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return err(res, 404, `Ticket ${id} no encontrado`)
    return res.json(data)
  }

  if (usuario_id) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('creado_en', { ascending: false })
      .limit(10)

    if (error) return err(res, 500, 'Error al consultar tickets')

    const tickets = (data as Ticket[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      categoria: t.categoria,
      prioridad: t.prioridad,
      estado: t.estado,
      creado_en: t.creado_en,
      actualizado_en: t.actualizado_en,
    }))

    return res.json({ total: tickets.length, tickets })
  }

  return err(res, 400, 'Se requiere el parámetro id o usuario_id')
})

// POST /tickets  — crear ticket de soporte
// Body: { usuario_id, titulo, descripcion, categoria, prioridad? }
app.post('/tickets', async (req, res) => {
  const { usuario_id, titulo, descripcion, categoria, prioridad } = req.body

  if (!usuario_id || !titulo || !descripcion || !categoria) {
    return err(res, 400, 'Faltan campos requeridos: usuario_id, titulo, descripcion, categoria')
  }

  const categoriasValidas = ['bug', 'consulta', 'facturacion', 'acceso', 'otro']
  if (!categoriasValidas.includes(categoria)) {
    return err(res, 400, `Categoría inválida. Opciones: ${categoriasValidas.join(', ')}`)
  }

  const prioridadesValidas = ['baja', 'media', 'alta', 'critica']
  const prioridadFinal = prioridadesValidas.includes(prioridad) ? prioridad : 'media'

  // Verificar que el usuario existe
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, plan_id')
    .eq('id', usuario_id)
    .single()

  if (!usuario) return err(res, 404, `Usuario ${usuario_id} no encontrado`)

  const { data, error } = await supabase
    .from('tickets')
    .insert({ usuario_id, titulo, descripcion, categoria, prioridad: prioridadFinal })
    .select()
    .single()

  if (error) return err(res, 500, 'Error al crear el ticket')

  return res.status(201).json({
    mensaje: 'Ticket creado exitosamente',
    ticket_id: (data as Ticket).id,
    estado: (data as Ticket).estado,
    prioridad: (data as Ticket).prioridad,
  })
})

// PATCH /tickets/estado?id=xxx  — actualizar estado de un ticket
// Body: { estado: 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado' }
app.patch('/tickets/estado', async (req, res) => {
  const id = req.query.id as string
  if (!id) return err(res, 400, 'Se requiere el parámetro id')

  const { estado } = req.body
  const estadosValidos = ['abierto', 'en_progreso', 'resuelto', 'cerrado']
  if (!estado || !estadosValidos.includes(estado)) {
    return err(res, 400, `Estado inválido. Opciones: ${estadosValidos.join(', ')}`)
  }

  const { data, error } = await supabase
    .from('tickets')
    .update({ estado })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return err(res, 404, `Ticket ${id} no encontrado`)

  return res.json({ mensaje: 'Estado actualizado', ticket_id: id, estado })
})

// GET /planes  — listar planes disponibles
app.get('/planes', async (req, res) => {
  const { data, error } = await supabase
    .from('planes')
    .select('*')
    .order('precio_mensual')

  if (error) return err(res, 500, 'Error al consultar planes')

  return res.json({ planes: data })
})

// ── Healthcheck ───────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true }))

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 4000
app.listen(PORT, () => {
  console.log(`SaaS API corriendo en http://localhost:${PORT}`)
  console.log(`
Endpoints disponibles:
  GET   /usuarios/by-email?email=xxx    — identificar usuario por email
  GET   /usuarios?id=xxx               — info del usuario + plan
  GET   /tickets?usuario_id=xxx        — historial de tickets del usuario
  GET   /tickets?id=xxx                — detalle de un ticket
  POST  /tickets                       — crear ticket
  PATCH /tickets/estado?id=xxx         — actualizar estado del ticket
  GET   /planes                        — listar planes
  GET   /health                        — healthcheck
`)
})
