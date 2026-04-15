-- AlterTable: agrega columna slug opcional con índice único al modelo Cliente
ALTER TABLE "Cliente" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Cliente_slug_key" ON "Cliente"("slug");
