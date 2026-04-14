"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/clientes", label: "Clientes" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-white border-r flex flex-col">
      <div className="p-4">
        <h1 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Chatbot Builder
        </h1>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
