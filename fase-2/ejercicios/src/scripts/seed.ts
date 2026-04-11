import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Restaurante Don Pepito',
      // TODO: escribí el systemPrompt del restaurante.
      // Incluí: nombre, tipo de cocina, horarios, dirección, y 2-3 platos del menú.
      // Ejemplo de estructura:
      //   "Sos el asistente de [nombre]. Atendés de [horario].
      //    Estás ubicado en [dirección]. Tu menú incluye: ..."
      systemPrompt: `Sos el asistente de "Restaurante Don Pepito".
      Atendemos de lunes a sábado de 12:00 a 23:00.
      Estamos ubicados en Av. Siempreviva 742.
      Nuestro menú incluye:
      - Milanesa napolitana con papas fritas
      - Ravioles de ricota con salsa de tomate casera
      - Ensalada Caesar con pollo grillado
      - Tiramisú casero`,

      modelo: 'gemini-2.5-flash',
    },
  })

  console.log('Cliente creado:', cliente.id, '—', cliente.nombre)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
