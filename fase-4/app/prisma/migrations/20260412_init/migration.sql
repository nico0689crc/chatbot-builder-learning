CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "arquetipo" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),
    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversacion_clienteId_sessionId_key" ON "Conversacion"("clienteId", "sessionId");

ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
