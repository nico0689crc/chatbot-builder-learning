/**
 * Seed: Bot asistente interno de empresa
 * Arquetipo 5 — Asistente Interno: LogiCorp
 *
 * Caso real: empresa de logística con 200 empleados. RRHH recibe 30+ consultas
 * diarias sobre políticas y procedimientos que están en PDFs que nadie lee.
 *
 * El bot simula RAG: busca en la base de conocimiento y responde citando fuente
 * y versión. Si no encuentra, registra la pregunta para que RRHH la responda.
 *
 * Flujo: clasificador 3 ramas → agente_interno (temp baja) → ciclo ReAct
 *
 * Uso:
 *   npx ts-node prisma/seed-logicorp.ts
 *   npx ts-node prisma/seed-logicorp.ts --clean
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
      where: { nombre: 'LogiCorp Asistente Interno' },
    });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'LogiCorp Asistente Interno',
      slug: 'logicorp',
      arquetipo: 'interno',
      systemPrompt:
        'Sos el asistente interno de LogiCorp. El usuario es un empleado de la empresa, no un cliente. ' +
        'Antes de responder cualquier pregunta sobre políticas o procedimientos, usá las tools para buscar en la base de conocimiento. ' +
        'Siempre citá la fuente: "Según la política de [tema] (versión X.X)...". ' +
        'Si no encontrás información con buscar_politica ni buscar_procedimiento, registrá la pregunta con registrar_consulta_pendiente ' +
        'y avisale al empleado que RRHH le va a responder. ' +
        'Nunca inventes información de RRHH — solo usá lo que devuelvan las tools. ' +
        'Si preguntan sobre salarios, legajos o información confidencial, derivá directamente a RRHH. ' +
        'Tono: profesional y accesible.',
      widgetNombre: 'Asistente Interno LogiCorp',
      widgetColor: '#7c3aed',
      widgetBienvenida: 'Hola, soy el asistente interno de LogiCorp. ¿En qué te puedo ayudar?',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Tools ───────────────────────────────────────────────────────────────

  const toolPolitica = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'buscar_politica',
      descripcion:
        'Busca políticas internas de LogiCorp por tema. ' +
        'Devuelve el contenido, versión y fecha de la política. ' +
        'Usá esta tool para preguntas sobre reglas, beneficios, permisos o licencias.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/logicorp/politicas`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'tema',
              tipo: 'string',
              descripcion: 'Tema a buscar (ej: "vacaciones", "licencia por enfermedad", "gastos", "home office")',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolProcedimiento = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'buscar_procedimiento',
      descripcion:
        'Busca procedimientos operativos de LogiCorp por nombre. ' +
        'Devuelve los pasos, responsable y tiempo estimado. ' +
        'Usá esta tool para preguntas sobre cómo hacer algo paso a paso.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/logicorp/procedimientos`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'nombre',
              tipo: 'string',
              descripcion: 'Nombre del procedimiento (ej: "onboarding", "solicitud equipo", "baja voluntaria")',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolConsulta = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'registrar_consulta_pendiente',
      descripcion:
        'Registra una pregunta del empleado para que RRHH la responda. ' +
        'Usá esta tool cuando no encuentres información con buscar_politica ni buscar_procedimiento.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/logicorp/consultas-pendientes`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'pregunta',
              tipo: 'string',
              descripcion: 'La pregunta completa del empleado, con todo el contexto necesario',
              requerido: true,
            },
            {
              nombre: 'empleado_id',
              tipo: 'string',
              descripcion: 'Legajo o nombre del empleado que hace la consulta',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  console.log(`✓ Tool creada: ${toolPolitica.id} — buscar_politica`);
  console.log(`✓ Tool creada: ${toolProcedimiento.id} — buscar_procedimiento`);
  console.log(`✓ Tool creada: ${toolConsulta.id} — registrar_consulta_pendiente`);

  // ── 3. Flujo ───────────────────────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'Bot Asistente Interno',
      descripcion: 'Clasificador 3 ramas + agente con ciclo ReAct sobre base de conocimiento',
      campos: {
        createMany: {
          data: [
            { nombre: 'tipo_consulta', tipo: 'string',  reducer: 'last_wins', default: '"desconocido"' },
            { nombre: 'respondida',    tipo: 'boolean', reducer: 'last_wins', default: 'false' },
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
                field: 'tipo_consulta',
                categories: ['politica', 'procedimiento', 'desconocido'],
                prompt:
                  'Clasificá la pregunta del empleado en exactamente una categoría:\n' +
                  '"politica": pregunta sobre reglas, beneficios, permisos, licencias o código de conducta.\n' +
                  '"procedimiento": pregunta sobre cómo hacer algo paso a paso (onboarding, solicitudes, bajas).\n' +
                  '"desconocido": no cae claramente en ninguna categoría o es muy específica.',
              },
            },
            {
              nombre: 'agente_interno',
              tipo: 'llm_call',
              orden: 1,
              config: { temperature: 0.25, maxTokens: 300 },
            },
            {
              nombre: 'tools',
              tipo: 'tool_executor',
              orden: 2,
              config: {},
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__',      destino: 'clasificador',   condicion: null },
            { origen: 'clasificador',   destino: 'agente_interno', condicion: 'politica' },
            { origen: 'clasificador',   destino: 'agente_interno', condicion: 'procedimiento' },
            { origen: 'clasificador',   destino: 'agente_interno', condicion: 'desconocido' },
            { origen: 'agente_interno', destino: 'tools',          condicion: 'tools' },
            { origen: 'agente_interno', destino: '__end__',        condicion: '__end__' },
            { origen: 'tools',          destino: 'agente_interno', condicion: null },
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
  console.log('  # Política (busca en a5_politicas)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Cuántos días de vacaciones tenemos por año?","sessionId":"i1"}' | jq`);
  console.log('');
  console.log('  # Procedimiento (busca en a5_procedimientos)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Cómo hago para pedir una notebook nueva?","sessionId":"i2"}' | jq`);
  console.log('');
  console.log('  # Sin respuesta (registra consulta pendiente)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Hay política sobre uso de IA en el trabajo?","sessionId":"i3"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
