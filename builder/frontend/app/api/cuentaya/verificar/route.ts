import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { usuario_id, pin } = body

  if (!usuario_id || !pin) {
    return NextResponse.json({ error: 'usuario_id y pin son requeridos' }, { status: 400 })
  }

  const { data } = await supabase
    .from('a6_usuarios')
    .select('id, nombre, alias')
    .eq('id', usuario_id)
    .eq('pin', String(pin))
    .eq('activo', true)
    .single()

  if (!data) {
    return NextResponse.json({ valido: false })
  }

  return NextResponse.json({ valido: true, nombre: data.nombre, alias: data.alias })
}
