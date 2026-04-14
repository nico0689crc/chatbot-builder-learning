import Link from "next/link"
import { api, type Cliente } from "@/lib/api"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

export default async function ClientesPage() {
  let clientes: Cliente[] = []
  let error = ""

  try {
    clientes = await api.clientes.list()
  } catch (e) {
    error = "No se pudo conectar con el servidor. ¿Está corriendo el backend?"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} registrado{clientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/clientes/nuevo" className={cn(buttonVariants())}>
          + Nuevo cliente
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-4">
          {error}
        </p>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No hay clientes todavía</p>
          <p className="text-sm mt-1">Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Arquetipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nombre}</TableCell>
                  <TableCell>
                    <span className="capitalize">{cliente.arquetipo}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cliente.activo ? "default" : "secondary"}>
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(cliente.creadoEn).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clientes/${cliente.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Ver →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
