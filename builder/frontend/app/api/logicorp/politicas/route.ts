import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const tema = req.nextUrl.searchParams.get('tema')

  if (!tema) {
    return NextResponse.json({ error: 'Se requiere el parámetro tema' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a5_politicas')
    .select('id, tema, contenido, version, actualizada_en')
    .or(`tema.ilike.%${tema}%,contenido.ilike.%${tema}%`)
    .order('actualizada_en', { ascending: false })
    .limit(3)

  if (error) {
    return NextResponse.json({ error: 'Error al consultar políticas' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({
      encontradas: [],
      total: 0,
      mensaje: 'No se encontró política sobre ese tema',
    })
  }

  return NextResponse.json({ encontradas: data, total: data.length })
}
