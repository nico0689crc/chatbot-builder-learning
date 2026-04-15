import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const usuario_id = req.nextUrl.searchParams.get('usuario_id')
  const limite = Number(req.nextUrl.searchParams.get('limite') ?? '5')

  if (!usuario_id) {
    return NextResponse.json({ error: 'Se requiere el parámetro usuario_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a6_movimientos')
    .select('tipo, monto, descripcion, creado_en')
    .eq('usuario_id', usuario_id)
    .order('creado_en', { ascending: false })
    .limit(limite)

  if (error) {
    return NextResponse.json({ error: 'Error al consultar movimientos' }, { status: 500 })
  }

  return NextResponse.json({ movimientos: data ?? [] })
}
