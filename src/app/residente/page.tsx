import Link from "next/link";
import { contextoResidente } from "@/lib/contexto";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dinero, fecha, ETIQUETA_METODO, ETIQUETA_ESTADO_CARGO } from "@/lib/formato";

export const metadata = { title: "Mi estado de cuenta" };

const COLOR_PAGO: Record<string, string> = {
  en_revision: "bg-alerta-clara text-alerta",
  aplicado: "bg-marca-clara text-marca-oscura",
  rechazado: "bg-peligro-clara text-[#8e2a23]",
};
const ETIQUETA_PAGO: Record<string, string> = { en_revision: "En revisión", aplicado: "Aplicado", rechazado: "Rechazado" };

export default async function InicioResidente({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const ctx = await contextoResidente();
  const ids = ctx.unidades.map((u) => u.id);

  if (ids.length === 0) {
    return (
      <p className="tarjeta text-sm text-suave">
        Su cuenta todavía no está vinculada a ninguna unidad. Comuníquese con la administración.
      </p>
    );
  }

  const [{ data: estado }, { data: cargos }, { data: pagos }, { data: condo }] = await Promise.all([
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
  ]);

  const moneda = condo?.moneda_base ?? "CRC";
  const total = (estado ?? []).reduce((t: number, e: any) => t + Number(e.saldo_total), 0);
  const vencido = (estado ?? []).reduce((t: number, e: any) => t + Number(e.saldo_vencido), 0);
  const aFavor = (estado ?? []).reduce((t: number, e: any) => t + Number(e.saldo_favor), 0);
  const proximo = (cargos ?? [])[0] as any;
  const nombre = ctx.perfil?.nombre?.split(" ")[0];

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Hola{nombre ? `, ${nombre}` : ""}</h1>
      <Aviso ok={ok} error={error} />

      <section aria-label="Saldo" className="flex flex-col gap-3.5 rounded-2xl bg-marca p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#d6ede5]">{total > 0 ? "Saldo pendiente" : "Está al día"}</span>
          {proximo && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-marca-oscura">
              {vencido > 0 ? "Tiene saldo vencido" : `Vence ${fecha(proximo.fecha_vence)}`}
            </span>
          )}
        </div>
        <span className="text-4xl font-bold tracking-tight">{dinero(total, moneda)}</span>
        {aFavor > 0 && <span className="text-sm text-[#d6ede5]">Saldo a favor: {dinero(aFavor, moneda)}</span>}
        {vencido > 0 && <span className="text-sm text-[#ffd9d4]">Vencido: {dinero(vencido, moneda)}</span>}
        <Link href="/residente/pagar" className="flex min-h-12 items-center justify-center rounded-xl bg-white text-[15px] font-bold text-marca-oscura">
          Reportar pago
        </Link>
      </section>

      <section aria-labelledby="h-pend" className="flex flex-col gap-2.5">
        <h2 id="h-pend" className="text-base font-bold">
          Cargos pendientes
        </h2>
        {(cargos ?? []).length === 0 ? (
          <p className="tarjeta text-sm text-suave">No tiene cargos pendientes.</p>
        ) : (
          (cargos ?? []).map((c: any) => (
            <article key={c.id} className="tarjeta flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{c.concepto}</span>
                <span className="text-xs text-suave">
                  {ids.length > 1 && `${c.unidades?.codigo} · `}Vence {fecha(c.fecha_vence)} · {ETIQUETA_ESTADO_CARGO[c.estado]}
                </span>
              </div>
              <span className={`shrink-0 text-sm font-bold ${c.estado === "vencido" ? "text-peligro" : ""}`}>{dinero(c.saldo, c.moneda)}</span>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="h-pagos" className="flex flex-col gap-2.5">
        <h2 id="h-pagos" className="text-base font-bold">
          Mis pagos
        </h2>
        {(pagos ?? []).length === 0 ? (
          <p className="tarjeta text-sm text-suave">Aún no ha reportado pagos.</p>
        ) : (
          (pagos ?? []).map((p: any) => (
            <article key={p.id} className="tarjeta flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {ETIQUETA_METODO[p.metodo]} · {fecha(p.fecha_pago)}
                </span>
                <span className="text-sm font-bold">{dinero(p.monto, p.moneda)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={`pastilla ${COLOR_PAGO[p.estado] ?? ""}`}>{ETIQUETA_PAGO[p.estado] ?? p.estado}</span>
                {p.motivo_rechazo && <span className="text-xs text-[#8e2a23]">{p.motivo_rechazo}</span>}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
