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
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*, planes(*)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: `Usuario ${id} no encontrado` }, { status: 404 })
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
