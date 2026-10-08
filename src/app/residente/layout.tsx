import Link from "next/link";
import { contextoResidente } from "@/lib/contexto";
import { SelectorCondominio } from "@/components/selector-condominio";
import { cerrarSesion } from "@/app/(auth)/acciones";

export default async function ResidenteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoResidente();
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-6 pb-2">
        <div className="min-w-0">
          <SelectorCondominio actual={ctx.condominioId} condominios={ctx.condominios} />
          <p className="text-sm text-suave">{ctx.unidades.map((u) => u.codigo).join(", ") || "Sin unidad asignada"}</p>
        </div>
        <div className="flex items-center gap-3">
          {ctx.esAdmin && (
            <Link href="/admin" className="text-sm font-semibold text-marca">
              Administración
            </Link>
          )}
          <form action={cerrarSesion}>
            <button className="text-sm font-semibold text-suave">Salir</button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 pt-2 pb-28">{children}</main>
      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-2">
          <Link href="/residente" className="flex min-h-14 flex-col items-center justify-center text-xs font-bold text-marca-oscura">
            Inicio
          </Link>
          <Link href="/residente/pagar" className="flex min-h-14 flex-col items-center justify-center text-xs font-bold text-marca-oscura">
            Reportar pago
          </Link>
        </div>
      </nav>
    </div>
  );
}
