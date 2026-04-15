import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get('nombre')

  if (!nombre) {
    return NextResponse.json({ error: 'Se requiere el parámetro nombre' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a5_procedimientos')
    .select('nombre, pasos, responsable, tiempo_estimado')
    .ilike('nombre', `%${nombre}%`)
    .limit(2)

  if (error) {
    return NextResponse.json({ error: 'Error al consultar procedimientos' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ procedimiento: null, mensaje: 'Procedimiento no encontrado' })
  }

  return NextResponse.json({ procedimiento: data[0] })
}
