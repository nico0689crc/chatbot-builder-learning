import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { origen_id, destino_alias, monto, confirmado } = body

  if (!origen_id || !destino_alias || monto == null || confirmado == null) {
    return NextResponse.json(
      { error: 'origen_id, destino_alias, monto y confirmado son requeridos' },
      { status: 400 },
    )
  }

  if (Number(monto) <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  // Buscar destino
  const { data: destino } = await supabase
    .from('a6_usuarios')
    .select('id, nombre, alias')
    .eq('alias', destino_alias)
    .single()

  if (!destino) {
    return NextResponse.json({ error: `No se encontró el usuario con alias "${destino_alias}"` }, { status: 404 })
  }

  // Verificar saldo origen
  const { data: origen } = await supabase
    .from('a6_usuarios')
    .select('nombre, saldo')
    .eq('id', origen_id)
    .single()

  if (!origen) {
    return NextResponse.json({ error: 'Usuario origen no encontrado' }, { status: 404 })
  }

  if (Number(origen.saldo) < Number(monto)) {
    return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
  }

  // Preview sin ejecutar
  if (!confirmado) {
    return NextResponse.json({
      preview: true,
      origen: origen_id,
      destino_nombre: destino.nombre,
      destino_alias,
      monto: Number(monto),
      saldo_disponible: Number(origen.saldo),
    })
  }

  // Ejecutar transferencia
  const { error: errOrigen } = await supabase.rpc('transferir', {
    p_origen_id: origen_id,
    p_destino_alias: destino_alias,
    p_monto: Number(monto),
  })

  // Fallback si no existe la RPC: hacer las operaciones manualmente
  if (errOrigen) {
    const { error: e1 } = await supabase
      .from('a6_usuarios')
      .update({ saldo: Number(origen.saldo) - Number(monto) })
      .eq('id', origen_id)

    const { data: destinoActual } = await supabase
      .from('a6_usuarios')
      .select('saldo')
      .eq('alias', destino_alias)
      .single()

    const { error: e2 } = await supabase
      .from('a6_usuarios')
      .update({ saldo: Number(destinoActual!.saldo) + Number(monto) })
      .eq('alias', destino_alias)

    if (e1 || e2) {
      return NextResponse.json({ error: 'Error al ejecutar la transferencia' }, { status: 500 })
    }
  }

  // Registrar operación
  const { data: operacion, error: errOp } = await supabase
    .from('a6_operaciones')
    .insert({ origen_id, destino_alias, monto: Number(monto), estado: 'acreditada' })
    .select('id')
    .single()

  if (errOp || !operacion) {
    return NextResponse.json({ error: 'Error al registrar la operación' }, { status: 500 })
  }

  // Registrar movimientos
  await supabase.from('a6_movimientos').insert([
    {
      usuario_id: origen_id,
      tipo: 'debito',
      monto: Number(monto),
      descripcion: `Transferencia enviada a ${destino_alias}`,
    },
    {
      usuario_id: destino.id,
      tipo: 'credito',
      monto: Number(monto),
      descripcion: `Transferencia recibida de ${origen_id}`,
    },
  ])

  return NextResponse.json(
    {
      operacion_id: operacion.id,
      estado: 'acreditada',
      monto: Number(monto),
      destino_alias,
      mensaje: 'Transferencia acreditada',
    },
    { status: 201 },
  )
}
