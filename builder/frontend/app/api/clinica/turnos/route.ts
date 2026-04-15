import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { turno_id, nombre_paciente } = body

  if (!turno_id || !nombre_paciente) {
    return NextResponse.json(
      { error: 'Se requieren turno_id y nombre_paciente' },
      { status: 400 },
    )
  }

  // Verificar que el turno existe y sigue disponible
  const { data: turno, error: errorBuscar } = await supabase
    .from('a2_turnos')
    .select(`
      id,
      fecha,
      hora,
      disponible,
      a2_medicos (
        nombre,
        a2_especialidades ( nombre )
      )
    `)
    .eq('id', turno_id)
    .single()

  if (errorBuscar || !turno) {
    return NextResponse.json({ error: `Turno ${turno_id} no encontrado` }, { status: 404 })
  }

  if (!turno.disponible) {
    return NextResponse.json(
      { error: 'Ese turno ya fue reservado. Por favor elegí otro horario.' },
      { status: 409 },
    )
  }

  // Reservar el turno
  const { error: errorUpdate } = await supabase
    .from('a2_turnos')
    .update({ disponible: false, paciente_nombre: nombre_paciente.trim() })
    .eq('id', turno_id)

  if (errorUpdate) {
    return NextResponse.json({ error: 'Error al reservar el turno' }, { status: 500 })
  }

  const medico = (turno as any).a2_medicos
  return NextResponse.json(
    {
      confirmacion_id: turno_id,
      especialidad: medico?.a2_especialidades?.nombre ?? '',
      medico: medico?.nombre ?? '',
      fecha: turno.fecha,
      hora: turno.hora,
      paciente: nombre_paciente.trim(),
      mensaje: `Turno confirmado con ${medico?.nombre} el ${turno.fecha} a las ${turno.hora}.`,
    },
    { status: 201 },
  )
}
