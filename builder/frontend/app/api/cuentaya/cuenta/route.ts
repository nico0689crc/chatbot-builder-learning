import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const usuario_id = req.nextUrl.searchParams.get('usuario_id')

  if (!usuario_id) {
    return NextResponse.json({ error: 'Se requiere el parámetro usuario_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a6_usuarios')
    .select('alias, cvu, saldo')
    .eq('id', usuario_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const saldo_formateado = `$ ${Number(data.saldo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return NextResponse.json({ alias: data.alias, cvu: data.cvu, saldo: data.saldo, saldo_formateado })
}
