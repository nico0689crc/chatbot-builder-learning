import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { numero_pedido, motivo } = body

  if (!numero_pedido || !motivo) {
    return NextResponse.json({ error: 'numero_pedido y motivo son requeridos' }, { status: 400 })
  }

  // Verificar que el pedido existe
  const { data: pedido } = await supabase
    .from('a4_pedidos')
    .select('numero')
    .eq('numero', numero_pedido)
    .single()

  if (!pedido) {
    return NextResponse.json({ error: `Pedido ${numero_pedido} no encontrado` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('a4_devoluciones')
    .insert({ pedido_numero: numero_pedido, motivo })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Error al registrar la devolución' }, { status: 500 })
  }

  return NextResponse.json(
    {
      devolucion_id: data.id,
      estado: 'iniciada',
      plazo_dias: 5,
      mensaje: 'Tu devolución fue registrada. El reembolso se acredita en 5 días hábiles.',
    },
    { status: 201 },
  )
}
