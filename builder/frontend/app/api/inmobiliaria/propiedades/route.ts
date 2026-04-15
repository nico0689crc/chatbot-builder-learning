import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo')
  const zona = req.nextUrl.searchParams.get('zona')
  const presupuesto_max = req.nextUrl.searchParams.get('presupuesto_max')

  let query = supabase
    .from('a3_propiedades')
    .select('id, tipo, zona, precio, m2, ambientes, descripcion')
    .eq('disponible', true)
    .order('precio', { ascending: true })
    .limit(5)

  if (tipo) query = query.eq('tipo', tipo)
  if (zona) query = query.ilike('zona', `%${zona}%`)
  if (presupuesto_max) query = query.lte('precio', Number(presupuesto_max))

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Error al consultar propiedades' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({
      total: 0,
      propiedades: [],
      mensaje: 'No encontramos propiedades con esos criterios',
    })
  }

  return NextResponse.json({ total: data.length, propiedades: data })
}
