import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pregunta, empleado_id } = body

  if (!pregunta || !empleado_id) {
    return NextResponse.json({ error: 'pregunta y empleado_id son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('a5_consultas_pendientes')
    .insert({ pregunta, empleado_id })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Error al registrar la consulta' }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: data.id,
      mensaje: 'Tu consulta fue registrada. RRHH te va a responder antes del próximo día hábil.',
    },
    { status: 201 },
  )
}
