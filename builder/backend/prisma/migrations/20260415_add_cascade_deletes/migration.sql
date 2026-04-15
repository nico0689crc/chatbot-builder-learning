-- Add ON DELETE CASCADE to all relations that depend on Cliente and Conversacion

-- Conversacion → Cliente
ALTER TABLE "Conversacion" DROP CONSTRAINT IF EXISTS "Conversacion_clienteId_fkey";
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mensaje → Conversacion
ALTER TABLE "Mensaje" DROP CONSTRAINT IF EXISTS "Mensaje_conversacionId_fkey";
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey"
  FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MetricasMes → Cliente
ALTER TABLE "MetricasMes" DROP CONSTRAINT IF EXISTS "MetricasMes_clienteId_fkey";
ALTER TABLE "MetricasMes" ADD CONSTRAINT "MetricasMes_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FlujoDef → Cliente
ALTER TABLE "FlujoDef" DROP CONSTRAINT IF EXISTS "FlujoDef_clienteId_fkey";
ALTER TABLE "FlujoDef" ADD CONSTRAINT "FlujoDef_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conector → Tool
ALTER TABLE "Conector" DROP CONSTRAINT IF EXISTS "Conector_toolId_fkey";
ALTER TABLE "Conector" ADD CONSTRAINT "Conector_toolId_fkey"
  FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Parametro → Tool
ALTER TABLE "Parametro" DROP CONSTRAINT IF EXISTS "Parametro_toolId_fkey";
ALTER TABLE "Parametro" ADD CONSTRAINT "Parametro_toolId_fkey"
  FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
