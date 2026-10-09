import Link from "next/link";
import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { elegirCondominio } from "@/app/acciones-comunes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).cartera.titulo };
}

type Fila = {
  condominio_id: string;
  nombre: string;
  moneda: string;
  unidades: number;
  facturado: number;
  recaudado: number;
  mora: number;
  unidades_morosas: number;
  por_revisar: number;
  monto_por_revisar: number;
};

const FILTROS = ["todos", "revisar", "mora"] as const;
const ORDENES = ["nombre", "mora", "revisar", "recaudo"] as const;

function mesActual(locale: string) {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
  const y = ahora.getFullYear();
  const m = ahora.getMonth();
  const desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const sig = new Date(y, m + 1, 1);
  const hasta = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, "0")}-01`;
  const nombre = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(ahora);
  return { desde, hasta, nombre };
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function Cartera({ searchParams }: { searchParams: BuscarParams }) {
  const params = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { dinero } = formatos(t);
  const mes = mesActual(t.locale);

  const q = (params.q ?? "").trim();
  const filtro = (FILTROS as readonly string[]).includes(params.filtro ?? "") ? params.filtro! : "todos";
  const orden = (ORDENES as readonly string[]).includes(params.orden ?? "") ? params.orden! : "nombre";

  const { data, error } = await ctx.supabase.rpc("resumen_cartera", { p_desde: mes.desde, p_hasta: mes.hasta });
  const todas: Fila[] = ((data ?? []) as any[]).map((r) => ({
    ...r,
    unidades: Number(r.unidades),
    facturado: Number(r.facturado),
    recaudado: Number(r.recaudado),
    mora: Number(r.mora),
    unidades_morosas: Number(r.unidades_morosas),
    por_revisar: Number(r.por_revisar),
    monto_por_revisar: Number(r.monto_por_revisar),
  }));

  // Totales por moneda (no se suman colones con dólares)
  const totales = (moneda: string) => {
    const f = todas.filter((r) => r.moneda === moneda);
    return {
      cantidad: f.length,
      facturado: f.reduce((s, r) => s + r.facturado, 0),
      recaudado: f.reduce((s, r) => s + r.recaudado, 0),
      mora: f.reduce((s, r) => s + r.mora, 0),
      morosas: f.reduce((s, r) => s + r.unidades_morosas, 0),
      condosMora: f.filter((r) => r.mora > 0).length,
      revisar: f.reduce((s, r) => s + r.por_revisar, 0),
      montoRevisar: f.reduce((s, r) => s + r.monto_por_revisar, 0),
      condosRevisar: f.filter((r) => r.por_revisar > 0).length,
    };
  };
  const crc = totales("CRC");
  const usd = totales("USD");
  const pctCrc = crc.facturado > 0 ? Math.min(100, Math.round((crc.recaudado / crc.facturado) * 100)) : 0;

  const pct = (r: Fila) => (r.facturado > 0 ? Math.min(100, Math.round((r.recaudado / r.facturado) * 100)) : 0);
  let filas = todas.filter((r) => !q || normalizar(r.nombre).includes(normalizar(q)));
  if (filtro === "revisar") filas = filas.filter((r) => r.por_revisar > 0);
  if (filtro === "mora") filas = filas.filter((r) => r.mora > 0);
  filas.sort((a, b) => {
    if (orden === "mora") return b.mora - a.mora;
    if (orden === "revisar") return b.por_revisar - a.por_revisar;
    if (orden === "recaudo") return pct(a) - pct(b);
    return a.nombre.localeCompare(b.nombre, t.locale);
  });

  const enlace = (cambios: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q ? { q } : {}), filtro, orden, ...cambios });
    if (u.get("filtro") === "todos") u.delete("filtro");
    if (u.get("orden") === "nombre") u.delete("orden");
    const s = u.toString();
    return `/admin/condominios${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Encabezado titulo={t.cartera.titulo} subtitulo={t.cartera.subtitulo(todas.length, mes.nombre)} />
      <Aviso ok={params.ok} error={params.error ?? (error ? error.message : undefined)} />

      <section aria-label={t.cartera.totales} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.cartera.recaudado}</span>
          <span className="text-2xl font-bold tracking-tight">{dinero(crc.recaudado, "CRC")}</span>
          <div className="h-2 overflow-hidden rounded-full bg-linea-suave">
            <div className="h-2 bg-marca" style={{ width: `${pctCrc}%` }} />
          </div>
          <span className="text-sm text-suave">{t.cartera.deFacturado(pctCrc, dinero(crc.facturado, "CRC"))}</span>
          {usd.cantidad > 0 && <span className="text-xs text-suave">{t.cartera.otraMoneda(dinero(usd.recaudado, "USD"))}</span>}
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.cartera.mora}</span>
          <span className="text-2xl font-bold tracking-tight text-peligro">{dinero(crc.mora, "CRC")}</span>
          <span className="text-sm text-suave">{t.cartera.unidadesMorosas(crc.morosas + usd.morosas, crc.condosMora + usd.condosMora)}</span>
          {usd.cantidad > 0 && usd.mora > 0 && <span className="text-xs text-suave">{t.cartera.otraMoneda(dinero(usd.mora, "USD"))}</span>}
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.cartera.porRevisar}</span>
          <span className="text-2xl font-bold tracking-tight text-alerta">{crc.revisar + usd.revisar}</span>
          <span className="text-sm text-suave">
            {t.cartera.montoRevisar(dinero(crc.montoRevisar, "CRC"), crc.condosRevisar + usd.condosRevisar)}
          </span>
          {crc.revisar + usd.revisar > 0 && (
            <Link href={enlace({ filtro: "revisar", orden: "revisar" })} className="text-sm font-semibold text-acento">
              {t.cartera.filtros.revisar}
            </Link>
          )}
        </div>
      </section>

      <section className="tarjeta flex flex-col gap-4" aria-label={t.cartera.titulo}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form action="/admin/condominios" className="flex gap-2 lg:w-80" role="search">
            <input type="hidden" name="filtro" value={filtro} />
            <input type="hidden" name="orden" value={orden} />
            <label className="sr-only" htmlFor="q">
              {t.cartera.buscar}
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder={t.cartera.buscar} className="campo" />
            <button className="btn-secundario">{t.cartera.aplicar}</button>
          </form>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.cartera.filtro}>
              {FILTROS.map((f) => (
                <Link
                  key={f}
                  href={enlace({ filtro: f })}
                  aria-current={filtro === f ? "true" : undefined}
                  className={`rounded-full px-3 py-1.5 font-semibold ${filtro === f ? "tono-ok" : "text-tenue hover:bg-linea-suave"}`}
                >
                  {t.cartera.filtros[f]}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.cartera.ordenar}>
              <span className="text-suave">{t.cartera.ordenar}:</span>
              {ORDENES.map((o) => (
                <Link
                  key={o}
                  href={enlace({ orden: o })}
                  aria-current={orden === o ? "true" : undefined}
                  className={`rounded-md px-2 py-1 font-semibold ${orden === o ? "text-acento-fuerte underline underline-offset-4" : "text-tenue hover:text-tinta"}`}
                >
                  {t.cartera.ordenes[o]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-suave">{t.cartera.mostrando(filas.length, todas.length)}</p>

        {filas.length === 0 ? (
          <p className="text-sm text-suave">{t.cartera.sinResultados}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[760px]">
              <thead>
                <tr>
                  <th>{t.cartera.colCondominio}</th>
                  <th className="text-right">{t.cartera.colUnidades}</th>
                  <th>{t.cartera.colRecaudado}</th>
                  <th className="text-right">{t.cartera.colMora}</th>
                  <th className="text-right">{t.cartera.colRevisar}</th>
                  <th>
                    <span className="sr-only">{t.cartera.entrar}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const p = pct(r);
                  return (
                    <tr key={r.condominio_id} className={r.condominio_id === ctx.condominioId ? "bg-marca-clara/40" : ""}>
                      <td className="font-semibold">{r.nombre}</td>
                      <td className="text-right">{r.unidades}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-linea-suave">
                            <div className={`h-1.5 ${p < 50 ? "bg-peligro" : p < 80 ? "bg-alerta" : "bg-marca"}`} style={{ width: `${p}%` }} />
                          </div>
                          <span className="w-10 text-right font-semibold">{p} %</span>
                          <span className="hidden text-xs text-suave xl:inline">{dinero(r.recaudado, r.moneda)}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        {r.mora > 0 ? (
                          <>
                            <span className="block font-semibold text-peligro">{dinero(r.mora, r.moneda)}</span>
                            <span className="block text-xs text-suave">{t.cartera.morosas(r.unidades_morosas)}</span>
                          </>
                        ) : (
                          <span className="pastilla tono-ok">{t.cartera.alDia}</span>
                        )}
                      </td>
                      <td className="text-right">
                        {r.por_revisar > 0 ? (
                          <span className="pastilla tono-alerta">{r.por_revisar}</span>
                        ) : (
                          <span className="text-suave">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {r.por_revisar > 0 && (
                            <form action={elegirCondominio}>
                              <input type="hidden" name="condominio_id" value={r.condominio_id} />
                              <input type="hidden" name="destino" value="/admin/pagos" />
                              <button className="btn-suave min-h-9 px-3 text-xs whitespace-nowrap">{t.cartera.revisarPagos}</button>
                            </form>
                          )}
                          <form action={elegirCondominio}>
                            <input type="hidden" name="condominio_id" value={r.condominio_id} />
                            <input type="hidden" name="destino" value="/admin" />
                            <button className="btn-secundario min-h-9 px-3 text-xs">{t.cartera.entrar}</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
