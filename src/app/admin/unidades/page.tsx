import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { crearUnidad, importarUnidades, invitarResidente } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).unidades.titulo };
}

const TIPOS = ["apartamento", "casa", "local", "oficina", "lote", "parqueo", "bodega"];
const RELACIONES = ["propietario", "inquilino", "familiar", "apoderado"];

export default async function Unidades({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { dinero } = formatos(t);
  const { supabase, condominioId } = ctx;

  const [{ data: unidades }, { data: estado }, { data: condo }] = await Promise.all([
    supabase
      .from("unidades")
      .select("id, codigo, tipo, coeficiente, area_m2, finca_filial, unidad_personas(relacion, usuarios(nombre, apellidos, email))")
      .eq("condominio_id", condominioId)
      .order("codigo"),
    supabase.from("v_estado_cuenta_unidad").select("unidad_id, saldo_total, condicion").eq("condominio_id", condominioId),
    supabase.from("condominios").select("moneda_base").eq("id", condominioId).single(),
  ]);

  const saldo = new Map((estado ?? []).map((e: any) => [e.unidad_id, e]));
  const moneda = condo?.moneda_base ?? "CRC";
  const sumaCoef = (unidades ?? []).reduce((s: number, u: any) => s + Number(u.coeficiente), 0);
  const numero = (n: number, dec: number) =>
    new Intl.NumberFormat(t.locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

  return (
    <>
      <Encabezado titulo={t.unidades.titulo} subtitulo={t.unidades.subtitulo(unidades?.length ?? 0, numero(sumaCoef, 2))} />
      <Aviso ok={ok} error={error} />
      {unidades && unidades.length > 0 && Math.abs(sumaCoef - 100) > 0.01 && (
        <p className="tono-alerta rounded-lg px-4 py-3 text-sm font-medium">{t.unidades.alertaCoef}</p>
      )}

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-lista">
        <h2 id="h-lista" className="text-lg font-bold">
          {t.unidades.listado}
        </h2>
        {(unidades ?? []).length === 0 ? (
          <p className="text-sm text-suave">{t.unidades.vacio}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[640px]">
              <thead>
                <tr>
                  <th>{t.comun.unidad}</th>
                  <th>{t.comun.tipo}</th>
                  <th className="text-right">{t.unidades.coeficiente}</th>
                  <th>{t.unidades.personas}</th>
                  <th className="text-right">{t.comun.saldo}</th>
                </tr>
              </thead>
              <tbody>
                {(unidades ?? []).map((u: any) => {
                  const e: any = saldo.get(u.id);
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold">
                        {u.codigo}
                        {u.finca_filial && <span className="block text-xs font-normal text-suave">{t.unidades.finca(u.finca_filial)}</span>}
                      </td>
                      <td className="text-suave">{t.tiposUnidad[u.tipo] ?? u.tipo}</td>
                      <td className="text-right">{numero(Number(u.coeficiente), 3)} %</td>
                      <td>
                        {(u.unidad_personas ?? []).length === 0 ? (
                          <span className="text-suave">{t.unidades.sinResidentes}</span>
                        ) : (
                          (u.unidad_personas ?? []).map((p: any, i: number) => (
                            <span key={i} className="block">
                              {p.usuarios?.nombre} <span className="text-xs text-suave">· {t.relaciones[p.relacion] ?? p.relacion}</span>
                            </span>
                          ))
                        )}
                      </td>
                      <td className="text-right">
                        {e && Number(e.saldo_total) > 0 ? (
                          <span className={`font-semibold ${e.condicion === "moroso" ? "text-peligro" : ""}`}>
                            {dinero(e.saldo_total, moneda)}
                          </span>
                        ) : (
                          <span className="pastilla tono-ok">{t.unidades.alDia}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-invitar">
          <h2 id="h-invitar" className="text-lg font-bold">
            {t.unidades.invitar}
          </h2>
          <p className="text-sm text-suave">{t.unidades.notaInvitar}</p>
          <form action={invitarResidente} className="flex flex-col gap-3">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="etiqueta">
                {t.comun.nombre}
                <input className="campo" name="nombre" required />
              </label>
              <label className="etiqueta">
                {t.comun.correo}
                <input className="campo" type="email" name="email" required />
              </label>
            </div>
            <label className="etiqueta">
              {t.unidades.relacion}
              <select className="campo" name="relacion" defaultValue="propietario">
                {RELACIONES.map((r) => (
                  <option key={r} value={r}>
                    {t.relaciones[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="responsable_pago" defaultChecked className="size-5 accent-[var(--marca)]" />{" "}
                {t.unidades.responsablePago}
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="puede_votar" defaultChecked className="size-5 accent-[var(--marca)]" /> {t.unidades.puedeVotar}
              </label>
            </div>
            <button className="btn-primario" disabled={(unidades ?? []).length === 0}>
              {t.unidades.enviarInvitacion}
            </button>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-nueva">
            <h2 id="h-nueva" className="text-lg font-bold">
              {t.unidades.agregarUnidad}
            </h2>
            <form action={crearUnidad} className="grid grid-cols-2 gap-3">
              <label className="etiqueta">
                {t.unidades.codigo}
                <input className="campo" name="codigo" placeholder="A-101" required />
              </label>
              <label className="etiqueta">
                {t.comun.tipo}
                <select className="campo" name="tipo" defaultValue="apartamento">
                  {TIPOS.map((v) => (
                    <option key={v} value={v}>
                      {t.tiposUnidad[v]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="etiqueta">
                {t.unidades.coeficientePct}
                <input className="campo" type="number" name="coeficiente" step="0.000001" min={0} max={100} required />
              </label>
              <label className="etiqueta">
                {t.unidades.area}
                <input className="campo" type="number" name="area_m2" step="0.01" min={0} />
              </label>
              <label className="etiqueta col-span-2">
                {t.unidades.fincaOpcional}
                <input className="campo" name="finca_filial" />
              </label>
              <button className="btn-primario col-span-2">{t.comun.agregar}</button>
            </form>
          </section>

          <section className="tarjeta flex flex-col gap-3" aria-labelledby="h-importar">
            <h2 id="h-importar" className="text-lg font-bold">
              {t.unidades.importar}
            </h2>
            <p className="text-sm text-suave">{t.unidades.notaImportar}</p>
            <form action={importarUnidades} className="flex flex-col gap-3">
              <label className="sr-only" htmlFor="lineas">
                {t.unidades.unidadesAImportar}
              </label>
              <textarea
                id="lineas"
                name="lineas"
                rows={5}
                className="campo py-2 font-mono text-sm"
                placeholder={"A-101, 1.5625, 80\nA-102, 1.5625, 80"}
                required
              />
              <button className="btn-secundario">{t.unidades.botonImportar}</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
