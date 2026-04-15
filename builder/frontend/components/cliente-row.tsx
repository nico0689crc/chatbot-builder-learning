"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api, type Cliente } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function ClienteRow({ cliente }: { cliente: Cliente }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${cliente.nombre}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await api.clientes.delete(cliente.id)
      router.refresh()
    } catch {
      alert("No se pudo eliminar el cliente. Intentá de nuevo.")
      setDeleting(false)
    }
  }

  return (
    <TableRow className={deleting ? "opacity-40 pointer-events-none" : ""}>
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
      <TableCell className="flex items-center gap-1 justify-end">
        <Link
          href={`/public/${cliente.slug}`}
          target="_blank"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Ver chatbot →
        </Link>
        <Link
          href={`/clientes/${cliente.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Editar →
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1.5 transition-colors"
        >
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </TableCell>
    </TableRow>
  )
}
