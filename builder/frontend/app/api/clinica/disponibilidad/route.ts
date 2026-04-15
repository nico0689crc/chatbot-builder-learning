import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const especialidad = req.nextUrl.searchParams.get('especialidad')
  const fecha = req.nextUrl.searchParams.get('fecha')

  console.log('especialidad', especialidad)
  console.log('fecha', fecha)

  if (!especialidad || !fecha) {
    return NextResponse.json(
      { error: 'Se requieren los parámetros especialidad y fecha (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json(
      { error: 'El parámetro fecha debe estar en formato YYYY-MM-DD' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('a2_turnos')
    .select(`
      id,
      hora,
      fecha,
      a2_medicos (
        id,
        nombre,
        a2_especialidades ( nombre )
      )
    `)
    .eq('disponible', true)
    .eq('fecha', fecha)
    .order('hora')

  if (error) {
    return NextResponse.json({ error: 'Error al consultar disponibilidad' }, { status: 500 })
  }

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const needle = normalize(especialidad)

  // Filtrar por especialidad ignorando mayúsculas y acentos
  const disponibles = (data ?? [])
    .filter((t: any) => {
      const nombre = t.a2_medicos?.a2_especialidades?.nombre
      return nombre && normalize(nombre).includes(needle)
    })
    .map((t: any) => ({
      turno_id: t.id,
      fecha: t.fecha,
      hora: t.hora,
      medico: t.a2_medicos.nombre,
      especialidad: t.a2_medicos.a2_especialidades.nombre,
    }))

  if (disponibles.length === 0) {
    return NextResponse.json({
      disponibles: [],
      mensaje: `No hay turnos disponibles de ${especialidad} para el ${fecha}`,
    })
  }

  return NextResponse.json({ disponibles })
}
