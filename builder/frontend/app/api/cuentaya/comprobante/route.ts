import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const operacion_id = req.nextUrl.searchParams.get('operacion_id')

  if (!operacion_id) {
    return NextResponse.json({ error: 'Se requiere el parámetro operacion_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a6_operaciones')
    .select('id, destino_alias, monto, estado, creado_en, a6_usuarios!origen_id(nombre)')
    .eq('id', operacion_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 })
  }

  const origen_nombre = (data.a6_usuarios as any)?.nombre ?? 'Desconocido'

  return NextResponse.json({
    comprobante: {
      id: data.id,
      origen_nombre,
      destino_alias: data.destino_alias,
      monto: data.monto,
      estado: data.estado,
      fecha: data.creado_en,
    },
  })
}
