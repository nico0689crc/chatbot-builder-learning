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

  console.log('Cliente creado:', cliente.id, '—', cliente.nombre)
  console.log('Copiá este ID en test-agente.ts:', cliente.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
