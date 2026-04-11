-- AlterTable
ALTER TABLE "Cliente" ALTER COLUMN "modelo" SET DEFAULT 'gemini-2.5-flash';

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'confirmado',
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
