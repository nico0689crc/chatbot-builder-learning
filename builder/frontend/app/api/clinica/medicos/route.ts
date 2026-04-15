import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const especialidad_id = req.nextUrl.searchParams.get('especialidad_id')

  let query = supabase
    .from('a2_medicos')
    .select('id, nombre, especialidad_id, a2_especialidades(nombre)')
    .eq('activo', true)
    .order('nombre')

  if (especialidad_id) {
    query = query.eq('especialidad_id', especialidad_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Error al consultar médicos' }, { status: 500 })
  }

  const medicos = (data ?? []).map((m: any) => ({
    id: m.id,
    nombre: m.nombre,
    especialidad: m.a2_especialidades?.nombre ?? m.especialidad_id,
  }))

  return NextResponse.json({ medicos })
}
