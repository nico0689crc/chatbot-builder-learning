/**
 * Seed: Bot híbrido de clínica médica
 * Arquetipo 2 — Agenda & Turnos
 *
 * Caso real: los recepcionistas coordinan toda la agenda manualmente desde el chat web.
 * Cada consulta de disponibilidad les lleva 3-5 minutos de búsqueda manual.
 * El bot consulta disponibilidad real en Supabase y reserva directamente.
 *
 * Flujo: 3 ramas (consulta / turno / urgencia) + ciclo ReAct en cada rama con tools.
 * Las tool URLs apuntan al frontend Next.js (FRONTEND_API_URL).
 *
 * Uso:
 *   npx ts-node prisma/seed-clinica.ts
 *   npx ts-node prisma/seed-clinica.ts --clean
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const API_BASE = process.env.FRONTEND_API_URL ?? 'http://localhost:3001';

async function main() {
  const clean = process.argv.includes('--clean');

  if (clean) {
    const existing = await prisma.cliente.findFirst({
      where: { nombre: 'Clínica Demo' },
    });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      const convIds = await prisma.conversacion
        .findMany({ where: { clienteId: existing.id }, select: { id: true } })
        .then(cs => cs.map(c => c.id));
      await prisma.mensaje.deleteMany({ where: { conversacionId: { in: convIds } } });
      await prisma.conversacion.deleteMany({ where: { clienteId: existing.id } });
      const toolIds = await prisma.tool
        .findMany({ where: { clienteId: existing.id }, select: { id: true } })
        .then(ts => ts.map(t => t.id));
      await prisma.conector.deleteMany({ where: { toolId: { in: toolIds } } });
      await prisma.parametro.deleteMany({ where: { toolId: { in: toolIds } } });
      await prisma.tool.deleteMany({ where: { clienteId: existing.id } });
      await prisma.flujoDef.deleteMany({ where: { clienteId: existing.id } });
      await prisma.metricasMes.deleteMany({ where: { clienteId: existing.id } });
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Clínica Demo',
      slug: 'clinica',
      arquetipo: 'turnos',
      systemPrompt:
        `Sos el asistente virtual de la Clínica Demo. La fecha de hoy es ${new Date().toISOString().slice(0, 10)}. ` +
        'Tu objetivo es ayudar a los pacientes con consultas, turnos y urgencias. ' +
        'Para consultas de disponibilidad de turnos usá SIEMPRE la tool buscar_disponibilidad. ' +
        'Para reservar un turno usá SIEMPRE la tool reservar_turno — nunca confirmes un turno sin llamarla. ' +
        'Para saber qué especialidades ofrece la clínica usá SIEMPRE la tool consultar_especialidades. ' +
        'Para saber qué médicos hay usá la tool consultar_medicos. ' +
        'Nunca inventes horarios ni confirmaciones — solo usá los datos que devuelvan las tools. ' +
        'Si el paciente menciona dolor fuerte, emergencia o urgencia médica, derivalo inmediatamente.',
      widgetNombre: 'Asistente Clínica Demo',
      widgetColor: '#0ea5e9',
      widgetBienvenida: '¡Hola! Soy el asistente de la Clínica Demo. ¿En qué puedo ayudarte?',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Tools ───────────────────────────────────────────────────────────────

  const toolBuscar = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'buscar_disponibilidad',
      descripcion:
        'Busca turnos médicos disponibles para una especialidad y fecha. ' +
        'Devuelve una lista de horarios disponibles con el médico asignado.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/clinica/disponibilidad`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'especialidad',
              tipo: 'string',
              descripcion: 'Especialidad médica (ej: cardiología, pediatría, clínica general)',
              requerido: true,
            },
            {
              nombre: 'fecha',
              tipo: 'string',
              descripcion: 'Fecha en formato YYYY-MM-DD. Convertí expresiones como "mañana" o "el jueves" a fecha real antes de llamar esta tool.',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolReservar = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'reservar_turno',
      descripcion:
        'Reserva un turno médico para el paciente usando el turno_id devuelto por buscar_disponibilidad. ' +
        'Devuelve la confirmación con todos los detalles del turno reservado.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/clinica/turnos`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'turno_id',
              tipo: 'string',
              descripcion: 'ID del turno obtenido de buscar_disponibilidad',
              requerido: true,
            },
            {
              nombre: 'nombre_paciente',
              tipo: 'string',
              descripcion: 'Nombre completo del paciente',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolEspecialidades = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'consultar_especialidades',
      descripcion:
        'Consulta la lista de especialidades médicas disponibles en la clínica. ' +
        'Usá esta tool cuando el paciente pregunte qué especialidades ofrecen.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/clinica/especialidades`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    },
  });

  const toolMedicos = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'consultar_medicos',
      descripcion:
        'Consulta la lista de médicos disponibles en la clínica. ' +
        'Usá esta tool cuando el paciente pregunte por médicos específicos o quiera saber quién atiende una especialidad.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/clinica/medicos`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    },
  });

  console.log(`✓ Tool creada: ${toolBuscar.id} — buscar_disponibilidad`);
  console.log(`✓ Tool creada: ${toolReservar.id} — reservar_turno`);
  console.log(`✓ Tool creada: ${toolEspecialidades.id} — consultar_especialidades`);
  console.log(`✓ Tool creada: ${toolMedicos.id} — consultar_medicos`);

  // ── 3. Flujo ───────────────────────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'Bot Híbrido Clínica',
      descripcion: '3 ramas (consulta / turno / urgencia) + ciclo ReAct en FAQ y turnos',
      campos: {
        createMany: {
          data: [
            { nombre: 'categoria',  tipo: 'string',  reducer: 'last_wins', default: '"sin_clasificar"' },
            { nombre: 'turno_id',   tipo: 'string',  reducer: 'last_wins', default: 'null' },
            { nombre: 'escalated',  tipo: 'boolean', reducer: 'last_wins', default: 'false' },
          ],
        },
      },
      nodos: {
        createMany: {
          data: [
            {
              nombre: 'clasificador',
              tipo: 'classifier',
              orden: 0,
              config: {
                field: 'categoria',
                categories: ['consulta', 'turno', 'urgencia'],
                prompt:
                  'Clasificá la intención del paciente en exactamente una categoría:\n' +
                  '"consulta": preguntas sobre especialidades, médicos, horarios de atención, coberturas o documentación.\n' +
                  '"turno": quiere pedir, reservar, modificar o cancelar un turno médico.\n' +
                  '"urgencia": menciona dolor fuerte, emergencia, accidente o necesita atención inmediata.',
              },
            },
            {
              nombre: 'agente_faq',
              tipo: 'llm_call',
              orden: 1,
              config: {},
            },
            {
              nombre: 'tools_faq',
              tipo: 'tool_executor',
              orden: 2,
              config: {},
            },
            {
              nombre: 'agente_turnos',
              tipo: 'llm_call',
              orden: 3,
              config: {},
            },
            {
              nombre: 'tools',
              tipo: 'tool_executor',
              orden: 4,
              config: {},
            },
            {
              nombre: 'handoff',
              tipo: 'human_handoff',
              orden: 5,
              config: {
                message:
                  'El paciente tiene una urgencia médica. ' +
                  'Respondé con calma, indicá que un operador lo va a contactar en menos de 5 minutos ' +
                  'y que si es una emergencia llame al 107.',
                escalatedField: 'escalated',
              },
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__',      destino: 'clasificador',  condicion: null },
            { origen: 'clasificador',   destino: 'agente_faq',    condicion: 'consulta' },
            { origen: 'clasificador',   destino: 'agente_turnos', condicion: 'turno' },
            { origen: 'clasificador',   destino: 'handoff',       condicion: 'urgencia' },
            { origen: 'agente_faq',     destino: 'tools_faq',     condicion: 'tools' },
            { origen: 'agente_faq',     destino: '__end__',       condicion: '__end__' },
            { origen: 'tools_faq',      destino: 'agente_faq',    condicion: null },
            { origen: 'agente_turnos',  destino: 'tools',         condicion: 'tools' },
            { origen: 'agente_turnos',  destino: '__end__',       condicion: '__end__' },
            { origen: 'tools',          destino: 'agente_turnos', condicion: null },
            { origen: 'handoff',        destino: '__end__',       condicion: null },
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
  console.log(`  Campos:  ${flujo.campos.length}`);
  console.log(`  Nodos:   ${flujo.nodos.length} → ${flujo.nodos.map(n => n.nombre).join(', ')}`);
  console.log(`  Aristas: ${flujo.aristas.length}`);

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed completado. Para testear:');
  console.log('');
  console.log(`  CLIENT_ID="${cliente.id}"`);
  console.log('');
  console.log('  # Rama consulta (llama consultar_especialidades)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Qué especialidades tienen?","sessionId":"c1"}' | jq`);
  console.log('');
  console.log('  # Rama turno (llama buscar_disponibilidad → reservar_turno)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Quiero un turno con cardiología para mañana","sessionId":"c2"}' | jq`);
  console.log('');
  console.log('  # Rama urgencia (handoff)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Tengo un dolor en el pecho muy fuerte","sessionId":"c3"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
