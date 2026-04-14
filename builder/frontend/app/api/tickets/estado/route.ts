import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 })
  }

  const body = await req.json()
  const { estado } = body

  const estadosValidos = ['abierto', 'en_progreso', 'resuelto', 'cerrado']
  if (!estado || !estadosValidos.includes(estado)) {
    return NextResponse.json(
      { error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('tickets')
    .update({ estado })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: `Ticket ${id} no encontrado` }, { status: 404 })
  }

  return NextResponse.json({ mensaje: 'Estado actualizado', ticket_id: id, estado })
}
