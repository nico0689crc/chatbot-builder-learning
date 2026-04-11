import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Clínica San Martín',
      systemPrompt: `Sos el asistente de turnos de "Clínica San Martín".
Ayudás a los pacientes a consultar disponibilidad, sacar y cancelar turnos.
Atendemos de lunes a viernes de 8:00 a 20:00.
Estamos ubicados en Av. San Martín 1250.
Cuando el usuario quiera un turno, primero verificá disponibilidad y luego confirmá el horario.
Siempre confirmá los datos antes de crear o cancelar un turno.`,
      modelo: 'gemini-2.5-flash',
    },
  })

  // Cargar turnos disponibles para los próximos días
  const turnosDisponibles = [
    { fecha: 'lunes',   hora: '09:00' },
    { fecha: 'lunes',   hora: '11:00' },
    { fecha: 'lunes',   hora: '15:00' },
    { fecha: 'martes',  hora: '10:00' },
    { fecha: 'martes',  hora: '15:00' },
    { fecha: 'martes',  hora: '17:00' },
    { fecha: 'miércoles', hora: '08:00' },
    { fecha: 'miércoles', hora: '14:00' },
    { fecha: 'jueves',  hora: '09:00' },
    { fecha: 'jueves',  hora: '16:00' },
    { fecha: 'viernes', hora: '10:00' },
    { fecha: 'viernes', hora: '13:00' },
    { fecha: 'próximos días', hora: '10:00' },
    { fecha: 'próximos días', hora: '15:00' },
    { fecha: 'próximos días', hora: '17:00' },
  ]

  await prisma.turno.createMany({
    data: turnosDisponibles.map(t => ({
      clienteId: cliente.id,
      usuarioId: 'disponible',  // marca que es un slot libre
      fecha: t.fecha,
      hora: t.hora,
      estado: 'disponible',
    })),
  })

  console.log('Cliente creado:', cliente.id, '—', cliente.nombre)
  console.log(`${turnosDisponibles.length} turnos disponibles cargados.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
