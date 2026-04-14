import Link from "next/link"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { MetricasDashboard } from "./metricas-dashboard"

export const dynamic = "force-dynamic"

function generarUltimosPeriodos(n: number): { value: string; label: string }[] {
  const periodos = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    periodos.push({ value, label })
  }
  return periodos
}

export default async function MetricasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periodo?: string }>
}) {
  const { id } = await params
  const { periodo: periodoParam } = await searchParams

  const periodos = generarUltimosPeriodos(6)
  const periodo = periodoParam ?? periodos[0].value

  const [cliente, metricas] = await Promise.all([
    api.clientes.get(id),
    api.metricas.get(id, periodo),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Métricas — {cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground mt-1">Reporte mensual de actividad del bot</p>
        </div>
        <Link
          href={`/clientes/${id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Volver
        </Link>
      </div>

      <MetricasDashboard
        clienteId={id}
        metricas={metricas}
        periodos={periodos}
        periodoActual={periodo}
      />
    </div>
  )
}
