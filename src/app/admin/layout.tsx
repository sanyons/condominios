import Link from "next/link";
import { contextoAdmin } from "@/lib/contexto";
import { NavEnlace } from "@/components/nav-enlace";
import { SelectorCondominio } from "@/components/selector-condominio";
import { cerrarSesion } from "@/app/(auth)/acciones";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoAdmin();
  const { count: porRevisar } = await ctx.supabase
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("condominio_id", ctx.condominioId)
    .eq("estado", "en_revision");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-linea bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="" width={32} height={32} />
              <span className="text-lg font-bold tracking-tight">Vecindo</span>
            </Link>
            <form action={cerrarSesion} className="lg:hidden">
              <button className="text-sm font-semibold text-suave">Salir</button>
            </form>
          </div>
          <SelectorCondominio actual={ctx.condominioId} condominios={ctx.condominios} />
          <nav aria-label="Menú principal" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            <NavEnlace href="/admin" exacto>
              Panel
            </NavEnlace>
            <NavEnlace href="/admin/unidades">Unidades y residentes</NavEnlace>
            <NavEnlace href="/admin/cobros">Cuotas y cobros</NavEnlace>
            <NavEnlace href="/admin/pagos">
              Pagos
              {!!porRevisar && (
                <span className="ml-2 rounded-full bg-alerta-clara px-2 py-0.5 text-xs font-bold text-alerta">{porRevisar}</span>
              )}
            </NavEnlace>
            <NavEnlace href="/admin/ajustes">Configuración</NavEnlace>
            {ctx.esResidente && <NavEnlace href="/residente">Mi unidad</NavEnlace>}
            <NavEnlace href="/onboarding">+ Agregar condominio</NavEnlace>
          </nav>
          <div className="mt-auto hidden items-center justify-between gap-2 border-t border-linea pt-4 lg:flex">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{ctx.perfil?.nombre ?? ctx.user.email}</p>
              <p className="text-xs capitalize text-suave">{ctx.roles.join(", ")}</p>
            </div>
            <form action={cerrarSesion}>
              <button className="text-sm font-semibold text-suave hover:text-tinta">Salir</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
