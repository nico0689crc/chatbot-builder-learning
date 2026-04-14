import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabase
    .from('planes')
    .select('*')
    .order('precio_mensual')

  if (error) {
    return NextResponse.json({ error: 'Error al consultar planes' }, { status: 500 })
  }

  return NextResponse.json({ planes: data })
}
