import 'dotenv/config';
import express from 'express';
import { supabase } from './db';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// POST /buscar-disponibilidad
// Body: { especialidad: string, fecha: string }
app.post('/buscar-disponibilidad', async (req, res) => {
  const { especialidad, fecha } = req.body as { especialidad: string; fecha: string };

  const { data: esp } = await supabase
    .from('especialidades')
    .select('id')
    .ilike('nombre', `%${especialidad}%`)
    .single();

  if (!esp) {
    res.json({ turnos: [], mensaje: `No encontramos la especialidad "${especialidad}"` });
    return;
  }

  // Rango: si viene fecha filtramos ese día exacto, sino los próximos 7 días
  let desde: Date;
  let hasta: Date;

  if (fecha) {
    desde = new Date(fecha);
    desde.setHours(0, 0, 0, 0);
    hasta = new Date(fecha);
    hasta.setHours(23, 59, 59, 999);
  } else {
    desde = new Date();
    hasta = new Date();
    hasta.setDate(hasta.getDate() + 7);
  }

  const { data: slots } = await supabase
    .from('disponibilidad')
    .select('id, fecha_hora')
    .eq('especialidad_id', esp.id)
    .eq('disponible', true)
    .gte('fecha_hora', desde.toISOString())
    .lte('fecha_hora', hasta.toISOString())
    .order('fecha_hora');

  res.json({
    especialidad,
    turnos: (slots ?? []).map(s => ({
      id: s.id,
      fecha_hora: s.fecha_hora,
    })),
  });
});

// POST /reservar-turno
// Body: { especialidad: string, horario: string, nombre_paciente: string }
app.post('/reservar-turno', async (req, res) => {
  const { especialidad, horario, nombre_paciente } = req.body as {
    especialidad: string;
    horario: string;
    nombre_paciente: string;
  };

  console.log('especialidad:', especialidad);
  console.log('horario:', horario);
  console.log('nombre_paciente:', nombre_paciente);

  const { data: esp } = await supabase
    .from('especialidades')
    .select('id')
    .ilike('nombre', `%${especialidad}%`)
    .single();

  if (!esp) {
    res.status(404).json({ error: `Especialidad "${especialidad}" no encontrada` });
    return;
  }

  console.log('esp:', esp);

  // Buscar el slot más cercano al horario pedido que esté disponible
  const { data: slot } = await supabase
    .from('disponibilidad')
    .select('id, fecha_hora')
    .eq('especialidad_id', esp.id)
    .eq('disponible', true)
    .gte('fecha_hora', new Date(horario.includes('+') || horario.endsWith('Z') ? horario : horario + 'Z').toISOString())
    .order('fecha_hora')
    .limit(1)
    .single();

  console.log('slot:', slot);

  if (!slot) {
    res.status(409).json({ error: 'No hay turnos disponibles para ese horario' });
    return;
  }

  const confirmacion = randomUUID().slice(0, 8).toUpperCase();

  const { error } = await supabase.from('reservas').insert({
    especialidad_id: esp.id,
    disponibilidad_id: slot.id,
    nombre_paciente,
    confirmacion,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Marcar slot como no disponible
  await supabase.from('disponibilidad').update({ disponible: false }).eq('id', slot.id);

  res.json({
    confirmacion,
    especialidad,
    fecha_hora: slot.fecha_hora,
    nombre_paciente,
    mensaje: `Turno confirmado. Número de confirmación: ${confirmacion}`,
  });
});

app.post('/reservas/cancelar', async (req, res) => {
  try {
    const { confirmacion } = req.body;

    await supabase
      .from('reservas')
      .delete()
      .eq('confirmacion', confirmacion);

    res.json({
      mensaje: `Turno cancelado. Número de confirmación: ${confirmacion}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar el turno' });
  }
});

app.get('/especialidades', async (req, res) => {
  const { data: esp } = await supabase.from('especialidades').select('nombre');
  res.json(esp);
});

app.get('/medicos', async (req, res) => {
  const { data: medicos } = await supabase.from('medicos').select('nombre, especialidad_id');
  res.json(medicos);
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`turnos-api corriendo en http://localhost:${PORT}`));
