import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const numero = req.nextUrl.searchParams.get('numero_pedido')
    ?? req.nextUrl.searchParams.get('numero')

  if (!numero) {
    return NextResponse.json({ error: 'Se requiere el parámetro numero_pedido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a4_pedidos')
    .select('numero, cliente_nombre, estado, items, total, fecha_compra, fecha_estimada_entrega')
    .eq('numero', numero)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: `Pedido ${numero} no encontrado` }, { status: 404 })
  }

  return NextResponse.json({ pedido: data })
}
