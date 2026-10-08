import { contextoAdmin } from "@/lib/contexto";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dinero, fecha, mesActual, ETIQUETA_ESTADO_CARGO } from "@/lib/formato";
import { crearPlan, generarCuotas, crearCargo, procesarMora } from "./acciones";

export const metadata = { title: "Cuotas y cobros" };

const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-[#eef0ec] text-[#36413b]",
  parcial: "bg-alerta-clara text-alerta",
  pagado: "bg-marca-clara text-marca-oscura",
  vencido: "bg-peligro-clara text-[#8e2a23]",
  anulado: "bg-[#eef0ec] text-suave",
};

const METODOS: Record<string, string> = { coeficiente: "Por coeficiente", fija: "Monto fijo por unidad", area: "Por área (m²)" };

export default async function Cobros({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const ctx = await contextoAdmin();
  const { supabase, condominioId } = ctx;

  const [{ data: planes }, { data: cargos }, { data: unidades }, { data: condo }] = await Promise.all([
    supabase.from("planes_cuota").select("*").eq("condominio_id", condominioId).eq("activo", true).order("vigente_desde", { ascending: false }),
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

  return (
    <>
      <Encabezado titulo="Cuotas y cobros" subtitulo={`Vencimiento el día ${condo?.dia_vencimiento} · mora ${condo?.tasa_mora_mensual} % mensual`}>
        {ctx.puedeEditar && (
          <form action={procesarMora}>
            <button className="btn-secundario">Actualizar morosidad</button>
          </form>
        )}
      </Encabezado>
      <Aviso ok={ok} error={error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-generar">
          <h2 id="h-generar" className="text-lg font-bold">
            Generar cuotas del mes
          </h2>
          {(planes ?? []).length === 0 ? (
            <p className="text-sm text-suave">Primero cree un plan de cuota (a la derecha).</p>
          ) : (
            <form action={generarCuotas} className="flex flex-col gap-3">
              <label className="etiqueta">
                Plan
                <select className="campo" name="plan_id" required>
                  {(planes ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {METODOS[p.metodo]} · {dinero(p.monto_total ?? p.monto_unidad, p.moneda)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="etiqueta">
                Mes
                <input className="campo" type="month" name="mes" defaultValue={mesActual()} required />
              </label>
              <p className="text-sm text-suave">
                Se crea un cargo por unidad. Si ese mes ya se generó, no se duplica.
              </p>
              <button className="btn-primario" disabled={!ctx.puedeEditar}>
                Generar cuotas
              </button>
            </form>
          )}
          {(planes ?? []).length > 0 && (
            <ul className="flex flex-col border-t border-linea pt-3 text-sm">
              {(planes ?? []).map((p: any) => (
                <li key={p.id} className="flex justify-between py-1.5">
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="text-suave">
                    {METODOS[p.metodo]} · {p.periodicidad} · {dinero(p.monto_total ?? p.monto_unidad, p.moneda)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-plan">
          <h2 id="h-plan" className="text-lg font-bold">
            Nuevo plan de cuota
          </h2>
          <form action={crearPlan} className="grid grid-cols-2 gap-3">
            <label className="etiqueta col-span-2">
              Nombre
              <input className="campo" name="nombre" placeholder="Cuota de mantenimiento 2026" required />
            </label>
            <label className="etiqueta">
              Cómo se reparte
              <select className="campo" name="metodo" defaultValue="coeficiente">
                {Object.entries(METODOS).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="etiqueta">
              Monto
              <input className="campo" type="number" name="monto" min={0} step="0.01" required />
              <span className="text-xs font-normal text-suave">Total del mes; o por unidad si es monto fijo</span>
            </label>
            <label className="etiqueta">
              Tipo
              <select className="campo" name="tipo" defaultValue="cuota_ordinaria">
                <option value="cuota_ordinaria">Ordinaria</option>
                <option value="cuota_extraordinaria">Extraordinaria</option>
                <option value="agua">Agua</option>
              </select>
            </label>
            <label className="etiqueta">
              Periodicidad
              <select className="campo" name="periodicidad" defaultValue="mensual">
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
                <option value="unica">Única</option>
              </select>
            </label>
            <label className="etiqueta">
              Moneda
              <select className="campo" name="moneda" defaultValue={moneda}>
                <option value="CRC">Colones</option>
                <option value="USD">Dólares</option>
              </select>
            </label>
            <label className="etiqueta">
              Vigente desde
              <input className="campo" type="date" name="vigente_desde" defaultValue={`${mesActual()}-01`} required />
            </label>
            <button className="btn-primario col-span-2" disabled={!ctx.puedeEditar}>
              Crear plan
            </button>
          </form>
        </section>
      </div>

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-cargo">
        <h2 id="h-cargo" className="text-lg font-bold">
          Cargo individual (multa, cuota extraordinaria, otro)
        </h2>
        <form action={crearCargo} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="etiqueta lg:col-span-1">
            Unidad
            <select className="campo" name="unidad_id" required>
              {(unidades ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.codigo}
                </option>
              ))}
            </select>
          </label>
          <label className="etiqueta lg:col-span-1">
            Tipo
            <select className="campo" name="tipo" defaultValue="multa">
              <option value="multa">Multa</option>
              <option value="cuota_extraordinaria">Extraordinaria</option>
              <option value="agua">Agua</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="etiqueta lg:col-span-2">
            Concepto
            <input className="campo" name="concepto" required />
          </label>
          <label className="etiqueta">
            Monto
            <input className="campo" type="number" name="monto" min={1} step="0.01" required />
          </label>
          <label className="etiqueta">
            Vence
            <input className="campo" type="date" name="fecha_vence" required />
          </label>
          <input type="hidden" name="moneda" value={moneda} />
          <button className="btn-secundario sm:col-span-2 lg:col-span-6" disabled={!ctx.puedeEditar || (unidades ?? []).length === 0}>
            Registrar cargo
          </button>
        </form>
      </section>

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-recientes">
        <h2 id="h-recientes" className="text-lg font-bold">
          Cargos recientes
        </h2>
        {(cargos ?? []).length === 0 ? (
          <p className="text-sm text-suave">Aún no hay cargos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[640px]">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Concepto</th>
                  <th>Vence</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Saldo</th>
                  <th>Estado</th>
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
                      <span className={`pastilla ${COLOR_ESTADO[c.estado] ?? ""}`}>{ETIQUETA_ESTADO_CARGO[c.estado] ?? c.estado}</span>
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
