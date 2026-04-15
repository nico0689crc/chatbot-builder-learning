import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nombre, email, telefono, interes, presupuesto } = body

  if (!nombre || !email) {
    return NextResponse.json({ error: 'nombre y email son requeridos' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 })
  }

  // Calcular score
  let score = 0
  if (presupuesto > 150000) score += 40
  else if (presupuesto > 80000) score += 25
  if (telefono) score += 30
  if (interes && interes.length > 20) score += 30
  score = Math.min(score, 100)

  const { data, error } = await supabase
    .from('a3_leads')
    .insert({ nombre, email, telefono, interes, presupuesto, score })
    .select('id, nombre, score')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al registrar el lead' }, { status: 500 })
  }

  return NextResponse.json(
    {
      lead_id: data.id,
      nombre: data.nombre,
      score: data.score,
      mensaje: '¡Perfecto! Un asesor de PropNorte se va a contactar con vos en las próximas horas.',
    },
    { status: 201 },
  )
}
