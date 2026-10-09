import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos, hoyCR } from "@/lib/formato";
import { reportarPago } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).pagar.titulo };
}

export default async function Pagar({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { dinero } = formatos(t);
  const ids = ctx.unidades.map((u) => u.id);

  const [{ data: cuentas }, { data: estado }, { data: condo }] = await Promise.all([
    ctx.supabase.from("cuentas_bancarias").select("*").eq("condominio_id", ctx.condominioId).eq("activa", true),
    ids.length
      ? ctx.supabase.from("v_estado_cuenta_unidad").select("unidad_id, saldo_total").in("unidad_id", ids)
      : Promise.resolve({ data: [] as any[] }),
    ctx.supabase.from("condominios").select("moneda_base").eq("id", ctx.condominioId).single(),
  ]);
  const moneda = condo?.moneda_base ?? "CRC";
  const pendiente = (estado ?? []).reduce((s: number, e: any) => s + Number(e.saldo_total), 0);
  const codigos = ctx.unidades.map((u) => u.codigo).join(", ");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.pagar.titulo}</h1>
      <Aviso error={error} />

      {(cuentas ?? []).length > 0 && (
        <section aria-label={t.pagar.datosPago} className="flex flex-col gap-3 rounded-2xl bg-marca-clara p-4">
          {(cuentas ?? []).map((k: any) => (
            <div key={k.id} className="flex flex-col gap-0.5 text-sm">
              {k.sinpe_movil && (
                <p>
                  <span className="text-xs font-bold tracking-wide text-acento-fuerte">SINPE MÓVIL </span>
                  <span className="text-lg font-bold">{k.sinpe_movil}</span>
                </p>
              )}
              <p className="text-tenue">
                {k.banco} ({k.moneda}) · IBAN <span className="font-mono">{k.iban}</span>
              </p>
              <p className="text-tenue">{t.pagar.aNombre(k.titular)}</p>
            </div>
          ))}
          <p className="text-sm text-tenue">{t.pagar.detalle(codigos)}</p>
        </section>
      )}

      <form action={reportarPago} className="flex flex-col gap-4">
        {ctx.unidades.length > 1 ? (
          <label className="etiqueta">
            {t.comun.unidad}
            <select className="campo" name="unidad_id">
              {ctx.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="unidad_id" value={ctx.unidades[0]?.id ?? ""} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="etiqueta">
            {t.pagar.montoPagado}
            <input
              className="campo"
              type="number"
              name="monto"
              min={1}
              step="0.01"
              inputMode="decimal"
              defaultValue={pendiente > 0 ? pendiente : undefined}
              required
            />
          </label>
          <label className="etiqueta">
            {t.comun.metodo}
            <select className="campo" name="metodo" defaultValue="sinpe_movil">
              {["sinpe_movil", "transferencia", "deposito"].map((v) => (
                <option key={v} value={v}>
                  {t.metodos[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-suave">{t.pagar.pendiente(dinero(pendiente, moneda))}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="etiqueta">
            {t.pagar.comprobante}
            <input className="campo" name="referencia" inputMode="numeric" required />
          </label>
          <label className="etiqueta">
            {t.pagar.fechaPago}
            <input className="campo" type="date" name="fecha_pago" defaultValue={hoyCR()} required />
          </label>
        </div>
        <label className="etiqueta">
          {t.pagar.archivo}
          <input
            className="campo py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-marca-clara file:px-3 file:py-1.5 file:font-semibold file:text-acento-fuerte"
            type="file"
            name="comprobante"
            accept="image/*,application/pdf"
          />
        </label>
        <input type="hidden" name="moneda" value={moneda} />
        <p className="text-xs text-suave">{t.pagar.nota}</p>
        <button className="btn-primario min-h-13 text-base">{t.pagar.enviar}</button>
      </form>
    </>
  );
}
