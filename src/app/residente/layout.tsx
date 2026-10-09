import Link from "next/link";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { SelectorCondominio } from "@/components/selector-condominio";
import { Preferencias } from "@/components/preferencias";
import { cerrarSesion } from "@/app/(auth)/acciones";

export default async function ResidenteLayout({ children }: { children: React.ReactNode }) {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex flex-col gap-3 px-5 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="" width={28} height={28} />
            <span className="font-bold tracking-tight">Vecindo</span>
          </div>
          <div className="flex items-center gap-3">
            <Preferencias compacto />
            <form action={cerrarSesion}>
              <button className="text-sm font-semibold text-suave">{t.comun.salir}</button>
            </form>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SelectorCondominio actual={ctx.condominioId} condominios={ctx.condominios} />
            <p className="mt-1 text-sm text-suave">{ctx.unidades.map((u) => u.codigo).join(", ") || t.residente.sinUnidad}</p>
          </div>
          {ctx.esAdmin && (
            <Link href="/admin" className="shrink-0 text-sm font-semibold text-acento">
              {t.nav.administracion}
            </Link>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 pt-2 pb-28">{children}</main>
      <nav aria-label={t.nav.menu} className="fixed inset-x-0 bottom-0 border-t border-linea bg-superficie pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-2">
          <Link href="/residente" className="flex min-h-14 flex-col items-center justify-center text-xs font-bold text-acento-fuerte">
            {t.nav.inicio}
          </Link>
          <Link href="/residente/pagar" className="flex min-h-14 flex-col items-center justify-center text-xs font-bold text-acento-fuerte">
            {t.nav.reportarPago}
          </Link>
        </div>
      </nav>
    </div>
  );
}
