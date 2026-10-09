import Link from "next/link";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { SelectorCondominio } from "@/components/selector-condominio";
import { Preferencias } from "@/components/preferencias";
import { NavInferior } from "@/components/nav-inferior";
import { cerrarSesion } from "@/app/(auth)/acciones";

export default async function ResidenteLayout({ children }: { children: React.ReactNode }) {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex flex-col gap-3 px-5 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          <Link href="/residente" className="flex items-center gap-2">
            <img src="/icon.svg" alt="" width={28} height={28} />
            <span className="font-bold tracking-tight">Vecindo</span>
          </Link>
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
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-suave">
              <span>{ctx.unidades.map((u) => u.codigo).join(", ") || t.residente.sinUnidad}</span>
              {ctx.propiedades > 1 && (
                <Link href="/residente/propiedades" className="font-semibold text-acento">
                  {t.propiedades.enlace(ctx.propiedades)}
                </Link>
              )}
            </p>
          </div>
          {ctx.esAdmin && (
            <Link href="/admin" className="shrink-0 text-sm font-semibold text-acento">
              {t.nav.administracion}
            </Link>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 pt-2 pb-28">{children}</main>
      <NavInferior
        etiqueta={t.nav.menu}
        items={[
          { href: "/residente", texto: t.nav.inicio, icono: "inicio" },
          { href: "/residente/pagar", texto: t.nav.pagar, icono: "pagar" },
          { href: "/residente/reservas", texto: t.nav.reservas, icono: "reservas" },
          { href: "/residente/calendario", texto: t.nav.calendario, icono: "calendario" },
          { href: "/residente/documentos", texto: t.nav.documentos, icono: "documentos" },
        ]}
      />
    </div>
  );
}
