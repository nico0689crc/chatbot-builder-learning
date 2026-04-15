import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabase
    .from('a2_especialidades')
    .select('id, nombre, descripcion')
    .order('nombre')

  if (error) {
    return NextResponse.json({ error: 'Error al consultar especialidades' }, { status: 500 })
  }

  return NextResponse.json({ especialidades: data })
}
