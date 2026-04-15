/**
 * Seed: Bot FAQ de restaurante
 * Arquetipo 1 — FAQ & Info
 *
 * Caso real: "La Parrilla Don Roberto" recibe 50+ mensajes diarios en el chat web
 * con siempre las mismas preguntas: horarios, menú, precios, delivery, reservas.
 * El dueño pierde 2hs por día respondiendo. Toda la info cabe en el system prompt.
 *
 * Sin tools. Sin ciclo ReAct. Flujo de una sola pasada.
 *
 * Uso:
 *   npx ts-node prisma/seed-restaurante.ts
 *   npx ts-node prisma/seed-restaurante.ts --clean
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const clean = process.argv.includes('--clean');

  if (clean) {
    const existing = await prisma.cliente.findFirst({
      where: { nombre: 'La Parrilla Don Roberto' },
    });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      const convIds = await prisma.conversacion
        .findMany({ where: { clienteId: existing.id }, select: { id: true } })
        .then(cs => cs.map(c => c.id));
      await prisma.mensaje.deleteMany({ where: { conversacionId: { in: convIds } } });
      await prisma.conversacion.deleteMany({ where: { clienteId: existing.id } });
      await prisma.flujoDef.deleteMany({ where: { clienteId: existing.id } });
      await prisma.metricasMes.deleteMany({ where: { clienteId: existing.id } });
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'La Parrilla Don Roberto',
      slug: 'restaurante',
      arquetipo: 'faq',
      systemPrompt: `Sos el asistente virtual de La Parrilla Don Roberto, un restaurante de carnes y parrilla en Córdoba, Argentina.
Respondé siempre en español con un tono amigable y cercano. Sé conciso — máximo 3 oraciones por respuesta.

INFORMACIÓN DEL RESTAURANTE:
- Dirección: Av. Colón 1250, Nueva Córdoba, Córdoba
- Horarios: martes a domingo de 12:00 a 15:30 y de 20:00 a 23:30. Lunes cerrado.
- Teléfono: +54 351 456-7890
- Instagram: @laparrilladonroberto

MENÚ Y PRECIOS:
- Entraña: $8.500
- Bife de chorizo 300g: $9.200
- Costillas a la parrilla (porción): $7.800
- Vacío: $8.000
- Tabla de achuras para 2: $6.500
- Milanesa napolitana: $6.200
- Provoleta: $3.200
- Empanadas (unidad): $950
- Ensaladas: desde $2.500
- Agua: $800 | Gaseosa: $1.200 | Vino por copa: $1.800 | Jarra de sangría: $4.500

RESERVAS:
- Solo para grupos de 4 o más personas, por teléfono o chat
- Grupos menores a 4: sin reserva, orden de llegada
- Eventos o grupos de +15 personas: coordinar con 48hs de anticipación

DELIVERY:
- No tenemos delivery propio
- Estamos en PedidosYa y Rappi
- Horario de delivery: 12:00 a 15:00 y 20:00 a 22:30

ESTACIONAMIENTO:
- No contamos con estacionamiento propio
- Hay playa paga a media cuadra sobre Bv. San Juan

REGLAS:
- Si te preguntan algo que no está en esta información, respondé: "Para esa consulta te recomiendo llamarnos al +54 351 456-7890."
- No inventes precios, horarios ni información que no esté aquí.
- Si el usuario menciona una alergia o restricción alimentaria, indicale que consulte directamente con el local antes de venir.`,
      widgetNombre: 'Asistente La Parrilla',
      widgetColor: '#b45309',
      widgetBienvenida: 'Bienvenido a La Parrilla Don Roberto. ¿En qué te puedo ayudar?',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Flujo lineal (sin tools) ────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'FAQ Restaurante',
      descripcion: 'Flujo lineal — el agente responde directo desde el system prompt, sin tools ni ramificaciones',
      campos: {
        createMany: {
          data: [
            { nombre: 'categoria', tipo: 'string', reducer: 'last_wins', default: '"info"' },
          ],
        },
      },
      nodos: {
        createMany: {
          data: [
            {
              nombre: 'agente_faq',
              tipo: 'llm_call',
              orden: 0,
              config: {
                model: 'claude-haiku-4-5-20251001',
                temperature: 0.3,
                maxTokens: 150,
              },
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__', destino: 'agente_faq', condicion: null },
            { origen: 'agente_faq', destino: '__end__', condicion: '__end__' },
          ],
        },
      },
    },
    include: {
      campos: true,
      nodos: { orderBy: { orden: 'asc' } },
      aristas: true,
    },
  });

  console.log(`✓ Flujo creado: ${flujo.id} — ${flujo.nombre}`);
  console.log(`  Nodos:   ${flujo.nodos.length} → ${flujo.nodos.map(n => n.nombre).join(', ')}`);
  console.log(`  Aristas: ${flujo.aristas.length}`);

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed completado. Para testear:');
  console.log('');
  console.log(`  CLIENT_ID="${cliente.id}"`);
  console.log('');
  console.log('  # Horario');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿A qué hora cierran esta noche?","sessionId":"r1"}' | jq`);
  console.log('');
  console.log('  # Precio');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Cuánto sale el bife de chorizo?","sessionId":"r2"}' | jq`);
  console.log('');
  console.log('  # Fuera de scope (debe derivar al teléfono)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Tienen opciones veganas?","sessionId":"r3"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
