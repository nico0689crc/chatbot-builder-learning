-- CreateTable
CREATE TABLE "FlujoDef" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlujoDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampoDef" (
    "id" TEXT NOT NULL,
    "flujoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "reducer" TEXT NOT NULL,
    "default" TEXT NOT NULL DEFAULT 'null',

    CONSTRAINT "CampoDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodoDef" (
    "id" TEXT NOT NULL,
    "flujoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NodoDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AristaDef" (
    "id" TEXT NOT NULL,
    "flujoId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "condicion" TEXT,

    CONSTRAINT "AristaDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlujoDef_clienteId_key" ON "FlujoDef"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "CampoDef_flujoId_nombre_key" ON "CampoDef"("flujoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "NodoDef_flujoId_nombre_key" ON "NodoDef"("flujoId", "nombre");

-- AddForeignKey
ALTER TABLE "FlujoDef" ADD CONSTRAINT "FlujoDef_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoDef" ADD CONSTRAINT "CampoDef_flujoId_fkey" FOREIGN KEY ("flujoId") REFERENCES "FlujoDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodoDef" ADD CONSTRAINT "NodoDef_flujoId_fkey" FOREIGN KEY ("flujoId") REFERENCES "FlujoDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AristaDef" ADD CONSTRAINT "AristaDef_flujoId_fkey" FOREIGN KEY ("flujoId") REFERENCES "FlujoDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
