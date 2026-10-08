import { contextoResidente } from "@/lib/contexto";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dinero } from "@/lib/formato";
import { reportarPago } from "./acciones";

export const metadata = { title: "Reportar pago" };

function hoyCR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());
}

export default async function Pagar({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const ctx = await contextoResidente();
  const ids = ctx.unidades.map((u) => u.id);

  const [{ data: cuentas }, { data: estado }, { data: condo }] = await Promise.all([
    ctx.supabase.from("cuentas_bancarias").select("*").eq("condominio_id", ctx.condominioId).eq("activa", true),
    ids.length
      ? ctx.supabase.from("v_estado_cuenta_unidad").select("unidad_id, saldo_total").in("unidad_id", ids)
      : Promise.resolve({ data: [] as any[] }),
    ctx.supabase.from("condominios").select("moneda_base").eq("id", ctx.condominioId).single(),
  ]);
  const moneda = condo?.moneda_base ?? "CRC";
  const pendiente = (estado ?? []).reduce((t: number, e: any) => t + Number(e.saldo_total), 0);
  const codigos = ctx.unidades.map((u) => u.codigo).join(", ");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Reportar pago</h1>
      <Aviso error={error} />

      {(cuentas ?? []).length > 0 && (
        <section aria-label="Datos para pagar" className="flex flex-col gap-3 rounded-2xl bg-marca-clara p-4">
          {(cuentas ?? []).map((k: any) => (
            <div key={k.id} className="flex flex-col gap-0.5 text-sm">
              {k.sinpe_movil && (
                <p>
                  <span className="text-xs font-bold tracking-wide text-marca-oscura">SINPE MÓVIL </span>
                  <span className="text-lg font-bold">{k.sinpe_movil}</span>
                </p>
              )}
              <p className="text-[#36413b]">
                {k.banco} ({k.moneda}) · IBAN <span className="font-mono">{k.iban}</span>
              </p>
              <p className="text-[#36413b]">A nombre de {k.titular}</p>
            </div>
          ))}
          <p className="text-sm text-[#36413b]">En el detalle de la transferencia escriba: {codigos}</p>
        </section>
      )}

      <form action={reportarPago} className="flex flex-col gap-4">
        {ctx.unidades.length > 1 ? (
          <label className="etiqueta">
            Unidad
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
            Monto pagado
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
            Método
            <select className="campo" name="metodo" defaultValue="sinpe_movil">
              <option value="sinpe_movil">SINPE Móvil</option>
              <option value="transferencia">Transferencia</option>
              <option value="deposito">Depósito</option>
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-suave">Saldo pendiente: {dinero(pendiente, moneda)}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="etiqueta">
            Número de comprobante
            <input className="campo" name="referencia" inputMode="numeric" required />
          </label>
          <label className="etiqueta">
            Fecha del pago
            <input className="campo" type="date" name="fecha_pago" defaultValue={hoyCR()} required />
          </label>
        </div>
        <label className="etiqueta">
          Captura o PDF del comprobante
          <input
            className="campo py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-marca-clara file:px-3 file:py-1.5 file:font-semibold file:text-marca-oscura"
            type="file"
            name="comprobante"
            accept="image/*,application/pdf"
          />
        </label>
        <input type="hidden" name="moneda" value={moneda} />
        <p className="text-xs text-suave">La administración revisa los pagos en un día hábil. El pago se aplica primero a la deuda más antigua.</p>
        <button className="btn-primario min-h-13 text-base">Enviar comprobante</button>
      </form>
    </>
  );
}
