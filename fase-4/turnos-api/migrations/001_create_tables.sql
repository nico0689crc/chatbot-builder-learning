-- Especialidades médicas disponibles
CREATE TABLE especialidades (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

-- Slots de disponibilidad
CREATE TABLE disponibilidad (
  id SERIAL PRIMARY KEY,
  especialidad_id INTEGER NOT NULL REFERENCES especialidades(id),
  fecha_hora TIMESTAMPTZ NOT NULL,
  disponible BOOLEAN NOT NULL DEFAULT true
);

-- Reservas confirmadas
CREATE TABLE reservas (
  id SERIAL PRIMARY KEY,
  especialidad_id INTEGER NOT NULL REFERENCES especialidades(id),
  disponibilidad_id INTEGER NOT NULL REFERENCES disponibilidad(id),
  nombre_paciente TEXT NOT NULL,
  confirmacion TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed de especialidades
INSERT INTO especialidades (nombre) VALUES
  ('cardiología'),
  ('clínica general'),
  ('pediatría'),
  ('traumatología'),
  ('dermatología');

-- Seed de disponibilidad (próximos 7 días, algunos slots)
INSERT INTO disponibilidad (especialidad_id, fecha_hora) VALUES
  (1, NOW() + INTERVAL '1 day' + INTERVAL '9 hours'),
  (1, NOW() + INTERVAL '1 day' + INTERVAL '10 hours'),
  (1, NOW() + INTERVAL '2 days' + INTERVAL '11 hours'),
  (2, NOW() + INTERVAL '1 day' + INTERVAL '8 hours'),
  (2, NOW() + INTERVAL '1 day' + INTERVAL '14 hours'),
  (2, NOW() + INTERVAL '3 days' + INTERVAL '9 hours'),
  (3, NOW() + INTERVAL '1 day' + INTERVAL '10 hours'),
  (3, NOW() + INTERVAL '2 days' + INTERVAL '15 hours'),
  (4, NOW() + INTERVAL '2 days' + INTERVAL '9 hours'),
  (5, NOW() + INTERVAL '3 days' + INTERVAL '10 hours');


-- Médicos de la clínica
CREATE TABLE medicos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  especialidad_id INTEGER NOT NULL REFERENCES especialidades(id)
);

-- Seed de médicos
INSERT INTO medicos (nombre, especialidad_id) VALUES
  ('Dr. Carlos Rossi', 1),
  ('Dra. Ana Martínez', 1),
  ('Dr. Juan Pérez', 2),
  ('Dra. Laura Gómez', 2),
  ('Dr. Miguel Sánchez', 3),
  ('Dra. Sofía Fernández', 4),
  ('Dr. Ricardo Torres', 5);
