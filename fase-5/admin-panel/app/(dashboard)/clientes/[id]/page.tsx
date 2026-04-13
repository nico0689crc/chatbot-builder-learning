import Link from "next/link"
import { notFound } from "next/navigation"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WidgetConfig } from "@/components/widget-config"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {

  const { id } = await params

  // cliente es crítico — si falla, 404
  let cliente
  try {
    cliente = await api.clientes.get(id)
  } catch {
    notFound()
  }

  // tools y métricas fallan de forma independiente
  const [toolsResult, metricasResult] = await Promise.allSettled([
    api.tools.list(id),
    api.metricas.get(id),
  ])

  const tools = toolsResult.status === "fulfilled" ? toolsResult.value : null
  const metricas = metricasResult.status === "fulfilled" ? metricasResult.value : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>
            <Badge variant={cliente.activo ? "default" : "secondary"}>
              {cliente.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Arquetipo: {cliente.arquetipo} · ID: {cliente.id}
          </p>
        </div>
        <Link href="/clientes" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Volver
        </Link>
      </div>

      {/* Métricas */}
      {metricas ? (
        <div className="grid grid-cols-4 gap-4">
          <MetricaCard label="Conversaciones" value={metricas.conversacionesTotales} />
          <MetricaCard label="Mensajes" value={metricas.mensajesTotales} />
          <MetricaCard label="Tasa resolución" value={`${metricas.tasaResolucionPct}%`} />
          <MetricaCard
            label="Duración prom."
            value={`${metricas.duracionPromedioMin} min`}
            link={`/clientes/${cliente.id}/metricas`}
            linkLabel="Ver reporte completo →"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudieron cargar las métricas. El backend puede estar reiniciando.
        </div>
      )}

      {/* System prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 rounded-md p-4">
            {cliente.systemPrompt}
          </pre>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Tools {tools ? `(${tools.length})` : ""}
          </CardTitle>
          <Link
            href={`/clientes/${cliente.id}/tools/nueva`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            + Agregar tool
          </Link>
        </CardHeader>
        <CardContent>
          {!tools ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              No se pudieron cargar las tools.
            </p>
          ) : tools.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Este cliente no tiene tools configuradas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Conector</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-mono text-sm">{tool.nombre}</TableCell>
                    <TableCell className="text-sm">{tool.descripcion}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tool.conector ? `${tool.conector.tipo} · ${tool.conector.metodo}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tool.activa ? "default" : "secondary"}>
                        {tool.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Widget */}
      <WidgetConfig
        cliente={cliente}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}
      />
    </div>
  )
}

function MetricaCard({
  label,
  value,
  link,
  linkLabel,
}: {
  label: string
  value: string | number
  link?: string
  linkLabel?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
        {link && linkLabel && (
          <Link href={link} className="text-xs text-black underline underline-offset-2 mt-2 inline-block">
            {linkLabel}
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
