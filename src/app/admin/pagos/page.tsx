import Link from "next/link";
import { contextoAdmin } from "@/lib/contexto";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dinero, fecha, ETIQUETA_METODO } from "@/lib/formato";
import { aprobarPago, rechazarPago, registrarPago } from "./acciones";

export const metadata = { title: "Pagos" };

const COLOR: Record<string, string> = {
  en_revision: "bg-alerta-clara text-alerta",
  aplicado: "bg-marca-clara text-marca-oscura",
  rechazado: "bg-peligro-clara text-[#8e2a23]",
  reversado: "bg-[#eef0ec] text-suave",
};
const ETIQUETA: Record<string, string> = { en_revision: "En revisión", aplicado: "Aplicado", rechazado: "Rechazado", reversado: "Reversado" };

export default async function Pagos({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error, ver } = await searchParams;
  const historial = ver === "historial";
  const ctx = await contextoAdmin();
  const { supabase, condominioId } = ctx;

  let consulta = supabase
    .from("pagos")
    .select("id, monto, moneda, metodo, referencia, fecha_pago, estado, comprobante_url, motivo_rechazo, unidades(codigo), usuarios!pagos_pagado_por_fkey(nombre, apellidos)")
    .eq("condominio_id", condominioId)
    .order("creado_en", { ascending: !historial })
    .limit(historial ? 100 : 50);
  consulta = historial ? consulta.neq("estado", "en_revision") : consulta.eq("estado", "en_revision");

  const [{ data: pagos }, { data: unidades }, { data: condo }] = await Promise.all([
    consulta,
    supabase.from("unidades").select("id, codigo").eq("condominio_id", condominioId).order("codigo"),
    supabase.from("condominios").select("moneda_base").eq("id", condominioId).single(),
  ]);

  // Enlaces temporales (10 min) a los comprobantes privados
  const conEnlace = await Promise.all(
    (pagos ?? []).map(async (p: any) => {
      if (!p.comprobante_url) return { ...p, enlace: null };
      const { data } = await supabase.storage.from("comprobantes").createSignedUrl(p.comprobante_url, 600);
      return { ...p, enlace: data?.signedUrl ?? null };
    })
  );

  return (
    <>
      <Encabezado titulo="Pagos" />
      <Aviso ok={ok} error={error} />

      <nav aria-label="Vista" className="flex gap-2">
        <Link href="/admin/pagos" className={historial ? "btn-secundario" : "btn-suave"} aria-current={!historial ? "page" : undefined}>
          Por revisar
        </Link>
        <Link href="/admin/pagos?ver=historial" className={historial ? "btn-suave" : "btn-secundario"} aria-current={historial ? "page" : undefined}>
          Historial
        </Link>
      </nav>

      {conEnlace.length === 0 ? (
        <p className="tarjeta text-sm text-suave">{historial ? "Aún no hay pagos procesados." : "No hay pagos pendientes de revisión."}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {conEnlace.map((p: any) => (
            <li key={p.id} className="tarjeta flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-bold">
                    {p.unidades?.codigo} · {[p.usuarios?.nombre, p.usuarios?.apellidos].filter(Boolean).join(" ") || "Administración"}
                  </span>
                  <span className="text-sm text-suave">
                    {ETIQUETA_METODO[p.metodo] ?? p.metodo} · {fecha(p.fecha_pago)}
                    {p.referencia && ` · Ref. ${p.referencia}`}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lg font-bold">{dinero(p.monto, p.moneda)}</span>
                  <span className={`pastilla ${COLOR[p.estado]}`}>{ETIQUETA[p.estado]}</span>
                </div>
              </div>
              {p.motivo_rechazo && <p className="text-sm text-[#8e2a23]">Motivo: {p.motivo_rechazo}</p>}
              {p.enlace && (
                <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-marca">
                  Ver comprobante
                </a>
              )}
              {p.estado === "en_revision" && ctx.puedeEditar && (
                <div className="flex flex-col gap-2 border-t border-linea pt-3 sm:flex-row">
                  <form action={aprobarPago} className="sm:flex-1">
                    <input type="hidden" name="pago_id" value={p.id} />
                    <button className="btn-primario w-full">Aprobar</button>
                  </form>
                  <form action={rechazarPago} className="flex gap-2 sm:flex-[2]">
                    <input type="hidden" name="pago_id" value={p.id} />
                    <label className="sr-only" htmlFor={`motivo-${p.id}`}>
                      Motivo del rechazo
                    </label>
                    <input id={`motivo-${p.id}`} name="motivo" className="campo" placeholder="Motivo del rechazo" />
                    <button className="btn-peligro">Rechazar</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {ctx.puedeEditar && (
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-registrar">
          <h2 id="h-registrar" className="text-lg font-bold">
            Registrar pago recibido por la administración
          </h2>
          <form action={registrarPago} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="etiqueta">
              Unidad
              <select className="campo" name="unidad_id" required>
                {(unidades ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.codigo}
                  </option>
                ))}
              </select>
            </label>
            <label className="etiqueta">
              Método
              <select className="campo" name="metodo" defaultValue="transferencia">
                {Object.entries(ETIQUETA_METODO).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="etiqueta">
              Monto
              <input className="campo" type="number" name="monto" min={1} step="0.01" required />
            </label>
            <label className="etiqueta">
              Referencia
              <input className="campo" name="referencia" />
            </label>
            <label className="etiqueta">
              Fecha
              <input className="campo" type="date" name="fecha_pago" required />
            </label>
            <input type="hidden" name="moneda" value={condo?.moneda_base ?? "CRC"} />
            <button className="btn-primario sm:col-span-2 lg:col-span-5">Registrar y aplicar</button>
          </form>
        </section>
      )}
    </>
  );
}
