"use client"

import { useRouter, usePathname } from "next/navigation"
import { type Metricas } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props {
  clienteId: string
  metricas: Metricas
  periodos: { value: string; label: string }[]
  periodoActual: string
}

export function MetricasDashboard({ metricas, periodos, periodoActual }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function handlePeriodo(periodo: string) {
    router.push(`${pathname}?periodo=${periodo}`)
  }

  const sinDatos =
    metricas.conversacionesTotales === 0 && metricas.mensajesTotales === 0

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex gap-2 flex-wrap">
        {periodos.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodo(p.value)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors capitalize ${
              periodoActual === p.value
                ? "border-black bg-black text-white"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {sinDatos ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg bg-gray-50">
          <p className="text-lg">Sin actividad en este período</p>
          <p className="text-sm mt-1">
            Las métricas se registran automáticamente al cerrar conversaciones
          </p>
        </div>
      ) : (
        <>
          {/* KPIs 1–4 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Conversaciones"
              value={metricas.conversacionesTotales}
              descripcion="KPI 1"
            />
            <KpiCard
              label="Mensajes"
              value={metricas.mensajesTotales}
              descripcion="KPI 2"
            />
            <KpiCard
              label="Tasa de resolución"
              value={`${metricas.tasaResolucionPct}%`}
              descripcion="KPI 3"
              highlight={metricas.tasaResolucionPct >= 80}
            />
            <KpiCard
              label="Duración promedio"
              value={`${metricas.duracionPromedioMin} min`}
              descripcion="KPI 4"
            />
          </div>

          {/* KPI 5: Consultas frecuentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Temas más consultados
                <span className="text-xs font-normal text-muted-foreground">KPI 5</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricas.consultasFrecuentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              ) : (
                <div className="space-y-3">
                  {metricas.consultasFrecuentes.map((item, i) => {
                    const max = metricas.consultasFrecuentes[0].count
                    const pct = Math.round((item.count / max) * 100)
                    return (
                      <div key={item.tema} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-4">{i + 1}.</span>
                            <span className="font-medium capitalize">{item.tema}</span>
                          </div>
                          <Badge variant="secondary">{item.count}</Badge>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPI 6: Conversaciones por día */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Actividad diaria
                <span className="text-xs font-normal text-muted-foreground">KPI 6</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricas.conversacionesPorDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos para este período</p>
              ) : (
                <ActividadDiaria datos={metricas.conversacionesPorDia} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  descripcion,
  highlight,
}: {
  label: string
  value: string | number
  descripcion: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-2xl font-semibold ${highlight ? "text-green-600" : ""}`}>
          {value}
        </p>
        <p className="text-sm font-medium mt-1">{label}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </CardContent>
    </Card>
  )
}

function ActividadDiaria({ datos }: { datos: { dia: string; total: number }[] }) {
  const max = Math.max(...datos.map((d) => d.total))

  return (
    <div className="flex items-end gap-1 h-24">
      {datos.map((d) => {
        const pct = max > 0 ? (d.total / max) * 100 : 0
        const dia = new Date(d.dia + "T12:00:00").getDate()
        return (
          <div key={d.dia} className="flex flex-col items-center gap-1 flex-1 group">
            <div className="relative w-full flex items-end" style={{ height: "72px" }}>
              <div
                className="w-full bg-black rounded-sm transition-all group-hover:bg-gray-600"
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${d.dia}: ${d.total} conv.`}
              />
            </div>
            {datos.length <= 15 && (
              <span className="text-[10px] text-muted-foreground">{dia}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
