import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

interface Ticket {
  id: string
  usuario_id: string
  titulo: string
  descripcion: string
  categoria: string
  prioridad: string
  estado: string
  creado_en: string
  actualizado_en: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const usuario_id = searchParams.get('usuario_id')

  if (id) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: `Ticket ${id} no encontrado` }, { status: 404 })
    }
    return NextResponse.json(data)
  }

  if (usuario_id) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('creado_en', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: 'Error al consultar tickets' }, { status: 500 })
    }

    const tickets = (data as Ticket[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      categoria: t.categoria,
      prioridad: t.prioridad,
      estado: t.estado,
      creado_en: t.creado_en,
      actualizado_en: t.actualizado_en,
    }))

    return NextResponse.json({ total: tickets.length, tickets })
  }

  return NextResponse.json(
    { error: 'Se requiere el parámetro id o usuario_id' },
    { status: 400 },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { usuario_id, titulo, descripcion, categoria, prioridad } = body

  if (!usuario_id || !titulo || !descripcion || !categoria) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: usuario_id, titulo, descripcion, categoria' },
      { status: 400 },
    )
  }

  const categoriasValidas = ['bug', 'consulta', 'facturacion', 'acceso', 'otro']
  if (!categoriasValidas.includes(categoria)) {
    return NextResponse.json(
      { error: `Categoría inválida. Opciones: ${categoriasValidas.join(', ')}` },
      { status: 400 },
    )
  }

  const prioridadesValidas = ['baja', 'media', 'alta', 'critica']
  const prioridadFinal = prioridadesValidas.includes(prioridad) ? prioridad : 'media'

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, plan_id')
    .eq('id', usuario_id)
    .single()

  if (!usuario) {
    return NextResponse.json({ error: `Usuario ${usuario_id} no encontrado` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert({ usuario_id, titulo, descripcion, categoria, prioridad: prioridadFinal })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al crear el ticket' }, { status: 500 })
  }

  return NextResponse.json(
    {
      mensaje: 'Ticket creado exitosamente',
      ticket_id: (data as Ticket).id,
      estado: (data as Ticket).estado,
      prioridad: (data as Ticket).prioridad,
    },
    { status: 201 },
  )
}
