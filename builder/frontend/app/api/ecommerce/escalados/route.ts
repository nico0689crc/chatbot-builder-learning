import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

const PRIORIDADES_VALIDAS = ['baja', 'media', 'alta', 'critica'] as const
type Prioridad = typeof PRIORIDADES_VALIDAS[number]

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { resumen, prioridad } = body

  if (!resumen || !prioridad) {
    return NextResponse.json({ error: 'resumen y prioridad son requeridos' }, { status: 400 })
  }

  if (!PRIORIDADES_VALIDAS.includes(prioridad as Prioridad)) {
    return NextResponse.json(
      { error: 'prioridad debe ser: baja, media, alta o critica' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('a4_escalados')
    .insert({ resumen, prioridad })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Error al registrar el escalado' }, { status: 500 })
  }

  const tiempo_respuesta = prioridad === 'alta' || prioridad === 'critica' ? '2hs' : '24hs'

  return NextResponse.json(
    {
      ticket_id: data.id,
      prioridad,
      estado: 'abierto',
      tiempo_respuesta,
    },
    { status: 201 },
  )
}
