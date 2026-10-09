import Link from "next/link";
import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { diaCR, fechaCorta, isoCR } from "@/lib/fechas";
import { detalleEvento, type Evento } from "@/lib/calendario";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).nav.inicio };
}

const TONO_PAGO: Record<string, string> = {
  en_revision: "tono-alerta",
  aplicado: "tono-ok",
  rechazado: "tono-peligro",
};

export default async function InicioResidente({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { dinero, fecha } = formatos(t);
  const ids = ctx.unidades.map((u) => u.id);

  if (ids.length === 0) {
    return <p className="tarjeta text-sm text-suave">{t.residente.sinVinculo}</p>;
  }

  const [{ data: estado }, { data: cargos }, { data: pagos }, { data: condo }, { data: eventos }] = await Promise.all([
    ctx.supabase.from("v_estado_cuenta_unidad").select("*").in("unidad_id", ids),
    ctx.supabase
      .from("cargos")
      .select("id, concepto, saldo, monto, moneda, fecha_vence, estado, unidades(codigo)")
      .in("unidad_id", ids)
      .gt("saldo", 0)
      .neq("estado", "anulado")
      .order("fecha_vence"),
    ctx.supabase
      .from("pagos")
      .select("id, monto, moneda, metodo, fecha_pago, estado, motivo_rechazo")
      .in("unidad_id", ids)
      .order("creado_en", { ascending: false })
      .limit(10),
    ctx.supabase.from("condominios").select("moneda_base").eq("id", ctx.condominioId).single(),
    ctx.supabase
      .from("eventos")
      .select("id, titulo, descripcion, ubicacion, categoria, inicio, fin, todo_el_dia")
      .eq("condominio_id", ctx.condominioId)
      .gte("inicio", isoCR(diaCR(new Date())))
      .order("inicio")
      .limit(3),
  ]);

  const moneda = condo?.moneda_base ?? "CRC";
  const total = (estado ?? []).reduce((s: number, e: any) => s + Number(e.saldo_total), 0);
  const vencido = (estado ?? []).reduce((s: number, e: any) => s + Number(e.saldo_vencido), 0);
  const aFavor = (estado ?? []).reduce((s: number, e: any) => s + Number(e.saldo_favor), 0);
  const proximo = (cargos ?? [])[0] as any;
  const nombre = ctx.perfil?.nombre?.split(" ")[0];

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.residente.hola(nombre)}</h1>
      <Aviso ok={ok} error={error} />

      <section aria-label={t.residente.saldo} className="flex flex-col gap-3.5 rounded-2xl bg-marca p-5 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white/80">{total > 0 ? t.residente.saldoPendiente : t.residente.alDia}</span>
          {proximo && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#0a5242]">
              {vencido > 0 ? t.residente.tieneVencido : t.residente.venceEl(fecha(proximo.fecha_vence))}
            </span>
          )}
        </div>
        <span className="text-4xl font-bold tracking-tight">{dinero(total, moneda)}</span>
        {aFavor > 0 && <span className="text-sm text-white/80">{t.residente.aFavor(dinero(aFavor, moneda))}</span>}
        {vencido > 0 && <span className="text-sm text-white">{t.residente.vencido(dinero(vencido, moneda))}</span>}
        <Link
          href="/residente/pagar"
          className="flex min-h-12 items-center justify-center rounded-xl bg-white text-[15px] font-bold text-[#0a5242]"
        >
          {t.nav.reportarPago}
        </Link>
      </section>

      {(eventos ?? []).length > 0 && (
        <section aria-labelledby="h-fechas" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="h-fechas" className="text-base font-bold">
              {t.calendario.proximos}
            </h2>
            <Link href="/residente/calendario" className="text-sm font-semibold text-acento">
              {t.comun.verTodos}
            </Link>
          </div>
          <ul className="tarjeta flex flex-col divide-y divide-linea-suave p-0">
            {((eventos ?? []) as Evento[]).map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3">
                <span className="w-14 shrink-0 text-xs font-bold text-acento-fuerte capitalize">{fechaCorta(diaCR(e.inicio), t.locale)}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{e.titulo}</span>
                  <span className="block text-xs text-suave">{detalleEvento(e, t)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="h-pend" className="flex flex-col gap-2.5">
        <h2 id="h-pend" className="text-base font-bold">
          {t.residente.cargosPendientes}
        </h2>
        {(cargos ?? []).length === 0 ? (
          <p className="tarjeta text-sm text-suave">{t.residente.sinCargos}</p>
        ) : (
          (cargos ?? []).map((c: any) => (
            <article key={c.id} className="tarjeta flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{c.concepto}</span>
                <span className="text-xs text-suave">
                  {ids.length > 1 && `${c.unidades?.codigo} · `}
                  {t.residente.venceEl(fecha(c.fecha_vence))} · {t.estadosCargo[c.estado]}
                </span>
              </div>
              <span className={`shrink-0 text-sm font-bold ${c.estado === "vencido" ? "text-peligro" : ""}`}>{dinero(c.saldo, c.moneda)}</span>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="h-pagos" className="flex flex-col gap-2.5">
        <h2 id="h-pagos" className="text-base font-bold">
          {t.residente.misPagos}
        </h2>
        {(pagos ?? []).length === 0 ? (
          <p className="tarjeta text-sm text-suave">{t.residente.sinPagos}</p>
        ) : (
          (pagos ?? []).map((p: any) => (
            <article key={p.id} className="tarjeta flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {t.metodos[p.metodo]} · {fecha(p.fecha_pago)}
                </span>
                <span className="text-sm font-bold">{dinero(p.monto, p.moneda)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={`pastilla ${TONO_PAGO[p.estado] ?? "tono-neutro"}`}>{t.estadosPago[p.estado] ?? p.estado}</span>
                {p.motivo_rechazo && <span className="text-xs text-peligro-texto">{p.motivo_rechazo}</span>}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
