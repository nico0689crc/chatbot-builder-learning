import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

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

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Se requiere el parámetro email' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*, planes(*)')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: `No se encontró usuario con email ${email}` }, { status: 404 })
  }

  const u = data as Usuario
  return NextResponse.json({
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
}
