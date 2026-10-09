import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos, mesActual } from "@/lib/formato";
import { crearPlan, generarCuotas, crearCargo, procesarMora } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).cobros.titulo };
}

const TONO_ESTADO: Record<string, string> = {
  pendiente: "tono-neutro",
  parcial: "tono-alerta",
  pagado: "tono-ok",
  vencido: "tono-peligro",
  anulado: "tono-neutro",
};

export default async function Cobros({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { dinero, fecha } = formatos(t);
  const { supabase, condominioId } = ctx;

  const [{ data: planes }, { data: cargos }, { data: unidades }, { data: condo }] = await Promise.all([
    supabase
      .from("planes_cuota")
      .select("*")
      .eq("condominio_id", condominioId)
      .eq("activo", true)
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("cargos")
      .select("id, concepto, tipo, monto, saldo, moneda, fecha_vence, estado, unidades(codigo)")
      .eq("condominio_id", condominioId)
      .order("fecha_emision", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(30),
    supabase.from("unidades").select("id, codigo").eq("condominio_id", condominioId).order("codigo"),
    supabase.from("condominios").select("moneda_base, dia_vencimiento, tasa_mora_mensual").eq("id", condominioId).single(),
  ]);
  const moneda = condo?.moneda_base ?? "CRC";
  const mora = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 2 }).format(Number(condo?.tasa_mora_mensual ?? 0));

  return (
    <>
      <Encabezado titulo={t.cobros.titulo} subtitulo={t.cobros.subtitulo(Number(condo?.dia_vencimiento ?? 0), mora)}>
        {ctx.puedeEditar && (
          <form action={procesarMora}>
            <button className="btn-secundario">{t.cobros.actualizarMora}</button>
          </form>
        )}
      </Encabezado>
      <Aviso ok={ok} error={error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-generar">
          <h2 id="h-generar" className="text-lg font-bold">
            {t.cobros.generar}
          </h2>
          {(planes ?? []).length === 0 ? (
            <p className="text-sm text-suave">{t.cobros.primeroPlan}</p>
          ) : (
            <form action={generarCuotas} className="flex flex-col gap-3">
              <label className="etiqueta">
                {t.cobros.plan}
                <select className="campo" name="plan_id" required>
                  {(planes ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {t.cobros.metodos[p.metodo]} · {dinero(p.monto_total ?? p.monto_unidad, p.moneda)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="etiqueta">
                {t.cobros.mes}
                <input className="campo" type="month" name="mes" defaultValue={mesActual()} required />
              </label>
              <p className="text-sm text-suave">{t.cobros.notaGenerar}</p>
              <button className="btn-primario" disabled={!ctx.puedeEditar}>
                {t.cobros.botonGenerar}
              </button>
            </form>
          )}
          {(planes ?? []).length > 0 && (
            <ul className="flex flex-col border-t border-linea pt-3 text-sm">
              {(planes ?? []).map((p: any) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="text-suave">
                    {t.cobros.metodos[p.metodo]} · {t.cobros.periodos[p.periodicidad] ?? p.periodicidad} ·{" "}
                    {dinero(p.monto_total ?? p.monto_unidad, p.moneda)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-plan">
          <h2 id="h-plan" className="text-lg font-bold">
            {t.cobros.nuevoPlan}
          </h2>
          <form action={crearPlan} className="grid grid-cols-2 gap-3">
            <label className="etiqueta col-span-2">
              {t.comun.nombre}
              <input className="campo" name="nombre" placeholder={t.cobros.nombrePlanEjemplo} required />
            </label>
            <label className="etiqueta">
              {t.cobros.reparto}
              <select className="campo" name="metodo" defaultValue="coeficiente">
                {Object.entries(t.cobros.metodos).map(([v, txt]) => (
                  <option key={v} value={v}>
                    {txt}
                  </option>
                ))}
              </select>
            </label>
            <label className="etiqueta">
              {t.comun.monto}
              <input className="campo" type="number" name="monto" min={0} step="0.01" required />
              <span className="text-xs font-normal text-suave">{t.cobros.notaMonto}</span>
            </label>
            <label className="etiqueta">
              {t.comun.tipo}
              <select className="campo" name="tipo" defaultValue="cuota_ordinaria">
                <option value="cuota_ordinaria">{t.cobros.ordinaria}</option>
                <option value="cuota_extraordinaria">{t.cobros.extraordinaria}</option>
                <option value="agua">{t.cobros.agua}</option>
              </select>
            </label>
            <label className="etiqueta">
              {t.cobros.periodicidad}
              <select className="campo" name="periodicidad" defaultValue="mensual">
                {Object.entries(t.cobros.periodos).map(([v, txt]) => (
                  <option key={v} value={v}>
                    {txt}
                  </option>
                ))}
              </select>
            </label>
            <label className="etiqueta">
              {t.comun.moneda}
              <select className="campo" name="moneda" defaultValue={moneda}>
                <option value="CRC">{t.comun.colones}</option>
                <option value="USD">{t.comun.dolares}</option>
              </select>
            </label>
            <label className="etiqueta">
              {t.cobros.vigenteDesde}
              <input className="campo" type="date" name="vigente_desde" defaultValue={`${mesActual()}-01`} required />
            </label>
            <button className="btn-primario col-span-2" disabled={!ctx.puedeEditar}>
              {t.cobros.crearPlan}
            </button>
          </form>
        </section>
      </div>

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-cargo">
        <h2 id="h-cargo" className="text-lg font-bold">
          {t.cobros.cargoIndividual}
        </h2>
        <form action={crearCargo} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="etiqueta">
            {t.comun.unidad}
            <select className="campo" name="unidad_id" required>
              {(unidades ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.codigo}
                </option>
              ))}
            </select>
          </label>
          <label className="etiqueta">
            {t.comun.tipo}
            <select className="campo" name="tipo" defaultValue="multa">
              <option value="multa">{t.cobros.multa}</option>
              <option value="cuota_extraordinaria">{t.cobros.extraordinaria}</option>
              <option value="agua">{t.cobros.agua}</option>
              <option value="otro">{t.cobros.otro}</option>
            </select>
          </label>
          <label className="etiqueta lg:col-span-2">
            {t.comun.concepto}
            <input className="campo" name="concepto" required />
          </label>
          <label className="etiqueta">
            {t.comun.monto}
            <input className="campo" type="number" name="monto" min={1} step="0.01" required />
          </label>
          <label className="etiqueta">
            {t.comun.vence}
            <input className="campo" type="date" name="fecha_vence" required />
          </label>
          <input type="hidden" name="moneda" value={moneda} />
          <button className="btn-secundario sm:col-span-2 lg:col-span-6" disabled={!ctx.puedeEditar || (unidades ?? []).length === 0}>
            {t.cobros.registrarCargo}
          </button>
        </form>
      </section>

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-recientes">
        <h2 id="h-recientes" className="text-lg font-bold">
          {t.cobros.recientes}
        </h2>
        {(cargos ?? []).length === 0 ? (
          <p className="text-sm text-suave">{t.cobros.sinCargos}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[640px]">
              <thead>
                <tr>
                  <th>{t.comun.unidad}</th>
                  <th>{t.comun.concepto}</th>
                  <th>{t.comun.vence}</th>
                  <th className="text-right">{t.comun.monto}</th>
                  <th className="text-right">{t.comun.saldo}</th>
                  <th>{t.comun.estado}</th>
                </tr>
              </thead>
              <tbody>
                {(cargos ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.unidades?.codigo}</td>
                    <td>{c.concepto}</td>
                    <td className="text-suave">{fecha(c.fecha_vence)}</td>
                    <td className="text-right">{dinero(c.monto, c.moneda)}</td>
                    <td className="text-right font-semibold">{dinero(c.saldo, c.moneda)}</td>
                    <td>
                      <span className={`pastilla ${TONO_ESTADO[c.estado] ?? "tono-neutro"}`}>{t.estadosCargo[c.estado] ?? c.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
