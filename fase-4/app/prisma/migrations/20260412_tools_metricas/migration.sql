-- Tool
CREATE TABLE IF NOT EXISTS "Tool" (
    "id"          TEXT NOT NULL,
    "clienteId"   TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tool_clienteId_nombre_key" ON "Tool"("clienteId", "nombre");

DO $$ BEGIN
  ALTER TABLE "Tool" ADD CONSTRAINT "Tool_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conector
CREATE TABLE IF NOT EXISTS "Conector" (
    "id"      TEXT NOT NULL,
    "toolId"  TEXT NOT NULL,
    "tipo"    TEXT NOT NULL,
    "url"     TEXT NOT NULL,
    "metodo"  TEXT NOT NULL DEFAULT 'GET',
    "headers" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "Conector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conector_toolId_key" ON "Conector"("toolId");

DO $$ BEGIN
  ALTER TABLE "Conector" ADD CONSTRAINT "Conector_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Parametro
CREATE TABLE IF NOT EXISTS "Parametro" (
    "id"          TEXT NOT NULL,
    "toolId"      TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "tipo"        TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "requerido"   BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Parametro" ADD CONSTRAINT "Parametro_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- MetricasMes
CREATE TABLE IF NOT EXISTS "MetricasMes" (
    "id"                      TEXT NOT NULL,
    "clienteId"               TEXT NOT NULL,
    "periodo"                 TEXT NOT NULL,
    "conversaciones"          INTEGER NOT NULL DEFAULT 0,
    "mensajes"                INTEGER NOT NULL DEFAULT 0,
    "conversacionesEscaladas" INTEGER NOT NULL DEFAULT 0,
    "duracionPromedioMin"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualizadoEn"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricasMes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetricasMes_clienteId_periodo_key" ON "MetricasMes"("clienteId", "periodo");

DO $$ BEGIN
  ALTER TABLE "MetricasMes" ADD CONSTRAINT "MetricasMes_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
