import Link from "next/link";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { NavEnlace } from "@/components/nav-enlace";
import { SelectorCondominio } from "@/components/selector-condominio";
import { Preferencias } from "@/components/preferencias";
import { cerrarSesion } from "@/app/(auth)/acciones";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const [{ count: porRevisar }, { count: porAprobar }] = await Promise.all([
    ctx.supabase
      .from("pagos")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", ctx.condominioId)
      .eq("estado", "en_revision"),
    ctx.supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", ctx.condominioId)
      .eq("estado", "solicitada"),
  ]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-linea bg-superficie lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="" width={32} height={32} />
              <span className="text-lg font-bold tracking-tight">Vecindo</span>
            </Link>
            <div className="flex items-center gap-3 lg:hidden">
              <Preferencias compacto />
              <form action={cerrarSesion}>
                <button className="text-sm font-semibold text-suave">{t.comun.salir}</button>
              </form>
            </div>
          </div>
          <SelectorCondominio
            actual={ctx.condominioId}
            condominios={ctx.condominios}
            puedeAgregar={ctx.roles.includes("administrador")}
            mostrarCartera={ctx.condominiosAdmin > 1}
          />
          <nav aria-label={t.nav.menu} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {ctx.condominiosAdmin > 1 && <NavEnlace href="/admin/condominios">{t.nav.cartera}</NavEnlace>}
            <NavEnlace href="/admin" exacto>
              {t.nav.panel}
            </NavEnlace>
            <NavEnlace href="/admin/unidades">{t.nav.unidades}</NavEnlace>
            <NavEnlace href="/admin/cobros">{t.nav.cobros}</NavEnlace>
            <NavEnlace href="/admin/pagos">
              {t.nav.pagos}
              {!!porRevisar && <span className="pastilla tono-alerta ml-2">{porRevisar}</span>}
            </NavEnlace>
            <NavEnlace href="/admin/amenidades">
              {t.nav.amenidades}
              {!!porAprobar && <span className="pastilla tono-alerta ml-2">{porAprobar}</span>}
            </NavEnlace>
            <NavEnlace href="/admin/documentos">{t.nav.documentos}</NavEnlace>
            <NavEnlace href="/admin/calendario">{t.nav.calendario}</NavEnlace>
            <NavEnlace href="/admin/ajustes">{t.nav.ajustes}</NavEnlace>
            {ctx.esResidente && <NavEnlace href="/residente">{t.nav.miUnidad}</NavEnlace>}
            {ctx.propiedades > 0 && (ctx.propiedades > 1 || !ctx.esResidente) && (
              <NavEnlace href="/residente/propiedades">{t.propiedades.enlace(ctx.propiedades)}</NavEnlace>
            )}
          </nav>
          <div className="mt-auto hidden flex-col gap-4 border-t border-linea pt-4 lg:flex">
            <Preferencias />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ctx.perfil?.nombre ?? ctx.user.email}</p>
                <p className="text-xs text-suave">{ctx.roles.map((r) => t.roles[r] ?? r).join(", ")}</p>
              </div>
              <form action={cerrarSesion}>
                <button className="text-sm font-semibold text-suave hover:text-tinta">{t.comun.salir}</button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
