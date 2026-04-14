"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const prisma = new client_1.PrismaClient();
const TURNOS_API_BASE = process.env.TURNOS_API_URL ?? 'http://localhost:4000';
const BUSCAR_URL = `${TURNOS_API_BASE}/buscar-disponibilidad`;
const RESERVAR_URL = `${TURNOS_API_BASE}/reservar-turno`;
const ESPECIALIDADES_URL = `${TURNOS_API_BASE}/especialidades`;
const MEDICOS_URL = `${TURNOS_API_BASE}/medicos`;
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
    const cliente = await prisma.cliente.create({
        data: {
            nombre: 'Clínica Demo',
            arquetipo: 'turnos',
            systemPrompt: `Sos el asistente virtual de la Clínica Demo. La fecha de hoy es ${new Date().toISOString().slice(0, 10)}. ` +
                'Tu objetivo es ayudar a los pacientes con consultas, turnos y urgencias. ' +
                'Para consultas de disponibilidad de turnos usá SIEMPRE la tool buscar_disponibilidad. ' +
                'Para reservar un turno usá SIEMPRE la tool reservar_turno. ' +
                'Para saber qué especialidades ofrece la clínica usá SIEMPRE la tool consultar_especialidades. ' +
                'Nunca inventes horarios ni confirmaciones — solo usá los datos que devuelvan las tools. ' +
                'Si el paciente menciona dolor fuerte, emergencia o urgencia médica, derivalo inmediatamente.',
            widgetNombre: 'Asistente Clínica Demo',
            widgetColor: '#0ea5e9',
            widgetBienvenida: '¡Hola! Soy el asistente de la Clínica Demo. ¿En qué puedo ayudarte?',
        },
    });
    console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);
    const toolBuscar = await prisma.tool.create({
        data: {
            clienteId: cliente.id,
            nombre: 'buscar_disponibilidad',
            descripcion: 'Busca turnos médicos disponibles. Devuelve una lista de horarios disponibles ' +
                'para la especialidad y fecha solicitadas.',
            conector: {
                create: {
                    tipo: 'API_REST',
                    url: BUSCAR_URL,
                    metodo: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
            },
            parametros: {
                createMany: {
                    data: [
                        {
                            nombre: 'especialidad',
                            tipo: 'string',
                            descripcion: 'Especialidad médica (ej: cardiología, clínica general, pediatría)',
                            requerido: true,
                        },
                        {
                            nombre: 'fecha',
                            tipo: 'string',
                            descripcion: 'Fecha deseada en formato YYYY-MM-DD. Convertí siempre expresiones relativas ("mañana", "esta semana", "el jueves") a una fecha real antes de llamar esta tool.',
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
            descripcion: 'Reserva un turno médico para el paciente. Devuelve el número de confirmación ' +
                'y los detalles del turno reservado.',
            conector: {
                create: {
                    tipo: 'API_REST',
                    url: RESERVAR_URL,
                    metodo: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
            },
            parametros: {
                createMany: {
                    data: [
                        {
                            nombre: 'especialidad',
                            tipo: 'string',
                            descripcion: 'Especialidad médica del turno a reservar',
                            requerido: true,
                        },
                        {
                            nombre: 'horario',
                            tipo: 'string',
                            descripcion: 'Horario exacto del turno (ej: "2026-04-15 10:30")',
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
            descripcion: 'Consulta la lista de especialidades médicas disponibles en la clínica. ' +
                'Usá esta tool cuando el paciente pregunte qué especialidades ofrecen.',
            conector: {
                create: {
                    tipo: 'API_REST',
                    url: ESPECIALIDADES_URL,
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
            descripcion: 'Consulta la lista de médicos disponibles en la clínica. ' +
                'Usá esta tool cuando el paciente pregunte qué médicos ofrecen.',
            conector: {
                create: {
                    tipo: 'API_REST',
                    url: MEDICOS_URL,
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
    const flujo = await prisma.flujoDef.create({
        data: {
            clienteId: cliente.id,
            nombre: 'Bot Híbrido Clínica',
            descripcion: '3 ramas (consulta/turno/urgencia) + ciclo ReAct en FAQ (especialidades) y turnos',
            campos: {
                createMany: {
                    data: [
                        { nombre: 'categoria', tipo: 'string', reducer: 'last_wins', default: '"sin_clasificar"' },
                        { nombre: 'turno_id', tipo: 'string', reducer: 'last_wins', default: 'null' },
                        { nombre: 'escalated', tipo: 'boolean', reducer: 'last_wins', default: 'false' },
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
                                prompt: 'Clasificá la intención del paciente en exactamente una de estas categorías:\n' +
                                    '"consulta": preguntas sobre servicios, documentación, horarios de atención, médicos, coberturas.\n' +
                                    '"turno": quiere pedir, reservar, modificar o cancelar un turno médico.\n' +
                                    '"urgencia": menciona dolor fuerte, emergencia, accidente, o necesita atención inmediata.',
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
                                message: 'El paciente tiene una urgencia médica. ' +
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
                        { origen: '__start__', destino: 'clasificador', condicion: null },
                        { origen: 'clasificador', destino: 'agente_faq', condicion: 'consulta' },
                        { origen: 'clasificador', destino: 'agente_turnos', condicion: 'turno' },
                        { origen: 'clasificador', destino: 'handoff', condicion: 'urgencia' },
                        { origen: 'agente_faq', destino: 'tools_faq', condicion: 'tools' },
                        { origen: 'agente_faq', destino: '__end__', condicion: '__end__' },
                        { origen: 'tools_faq', destino: 'agente_faq', condicion: null },
                        { origen: 'agente_turnos', destino: 'tools', condicion: 'tools' },
                        { origen: 'agente_turnos', destino: '__end__', condicion: '__end__' },
                        { origen: 'tools', destino: 'agente_turnos', condicion: null },
                        { origen: 'handoff', destino: '__end__', condicion: null },
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
    console.log(`  Campos: ${flujo.campos.length}`);
    console.log(`  Nodos:  ${flujo.nodos.length} → ${flujo.nodos.map(n => n.nombre).join(', ')}`);
    console.log(`  Aristas: ${flujo.aristas.length}`);
    console.log('\n─────────────────────────────────────────────');
    console.log('Seed completado. Para debuggear:');
    console.log('');
    console.log(`  CLIENT_ID="${cliente.id}"`);
    console.log('');
    console.log('  # Rama consulta (sin tools, sin ciclo):');
    console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
    console.log(`    -H "x-client-id: ${cliente.id}" \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"mensaje":"¿Qué especialidades tienen?","sessionId":"debug-faq"}' | jq`);
    console.log('');
    console.log('  # Rama turno (con ciclo ReAct):');
    console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
    console.log(`    -H "x-client-id: ${cliente.id}" \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"mensaje":"Quiero un turno con cardiología para mañana","sessionId":"debug-turno"}' | jq`);
    console.log('');
    console.log('  # Rama urgencia (handoff, escalated=true):');
    console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
    console.log(`    -H "x-client-id: ${cliente.id}" \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"mensaje":"Tengo un dolor en el pecho muy fuerte","sessionId":"debug-urgencia"}' | jq`);
    console.log('─────────────────────────────────────────────\n');
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-clinica.js.map