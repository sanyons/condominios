import { contextoAdmin } from "@/lib/contexto";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dinero } from "@/lib/formato";
import { crearUnidad, importarUnidades, invitarResidente } from "./acciones";

export const metadata = { title: "Unidades y residentes" };

const TIPOS = ["apartamento", "casa", "local", "oficina", "lote", "parqueo", "bodega"];

export default async function Unidades({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const ctx = await contextoAdmin();
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
  const sumaCoef = (unidades ?? []).reduce((t: number, u: any) => t + Number(u.coeficiente), 0);

  return (
    <>
      <Encabezado titulo="Unidades y residentes" subtitulo={`${unidades?.length ?? 0} unidades · coeficientes suman ${sumaCoef.toFixed(2)} %`} />
      <Aviso ok={ok} error={error} />
      {unidades && unidades.length > 0 && Math.abs(sumaCoef - 100) > 0.01 && (
        <p className="rounded-lg bg-alerta-clara px-4 py-3 text-sm font-medium text-alerta">
          Los coeficientes deberían sumar 100 %. Revíselos antes de generar cuotas por coeficiente.
        </p>
      )}

      <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-lista">
        <h2 id="h-lista" className="text-lg font-bold">
          Listado
        </h2>
        {(unidades ?? []).length === 0 ? (
          <p className="text-sm text-suave">Todavía no hay unidades. Agréguelas abajo, una por una o pegando una lista.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[640px]">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Tipo</th>
                  <th className="text-right">Coeficiente</th>
                  <th>Personas</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(unidades ?? []).map((u: any) => {
                  const e: any = saldo.get(u.id);
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold">
                        {u.codigo}
                        {u.finca_filial && <span className="block text-xs font-normal text-suave">Finca {u.finca_filial}</span>}
                      </td>
                      <td className="capitalize text-suave">{u.tipo}</td>
                      <td className="text-right">{Number(u.coeficiente).toFixed(3)} %</td>
                      <td>
                        {(u.unidad_personas ?? []).length === 0 ? (
                          <span className="text-suave">Sin residentes</span>
                        ) : (
                          (u.unidad_personas ?? []).map((p: any, i: number) => (
                            <span key={i} className="block">
                              {p.usuarios?.nombre} <span className="text-xs text-suave">· {p.relacion}</span>
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
                          <span className="pastilla bg-marca-clara text-marca-oscura">Al día</span>
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
            Invitar residente
          </h2>
          <p className="text-sm text-suave">Recibe un correo para definir su contraseña y entrar a su estado de cuenta.</p>
          <form action={invitarResidente} className="flex flex-col gap-3">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="etiqueta">
                Nombre
                <input className="campo" name="nombre" required />
              </label>
              <label className="etiqueta">
                Correo
                <input className="campo" type="email" name="email" required />
              </label>
            </div>
            <label className="etiqueta">
              Relación con la unidad
              <select className="campo" name="relacion" defaultValue="propietario">
                <option value="propietario">Propietario</option>
                <option value="inquilino">Inquilino</option>
                <option value="familiar">Familiar</option>
                <option value="apoderado">Apoderado</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="responsable_pago" defaultChecked className="size-5 accent-[#0e6b57]" /> Responsable de pago
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="puede_votar" defaultChecked className="size-5 accent-[#0e6b57]" /> Puede votar
              </label>
            </div>
            <button className="btn-primario" disabled={(unidades ?? []).length === 0}>
              Enviar invitación
            </button>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-nueva">
            <h2 id="h-nueva" className="text-lg font-bold">
              Agregar unidad
            </h2>
            <form action={crearUnidad} className="grid grid-cols-2 gap-3">
              <label className="etiqueta">
                Código
                <input className="campo" name="codigo" placeholder="A-101" required />
              </label>
              <label className="etiqueta">
                Tipo
                <select className="campo capitalize" name="tipo" defaultValue="apartamento">
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="etiqueta">
                Coeficiente %
                <input className="campo" type="number" name="coeficiente" step="0.000001" min={0} max={100} required />
              </label>
              <label className="etiqueta">
                Área m²
                <input className="campo" type="number" name="area_m2" step="0.01" min={0} />
              </label>
              <label className="etiqueta col-span-2">
                Finca filial (opcional)
                <input className="campo" name="finca_filial" />
              </label>
              <button className="btn-primario col-span-2">Agregar</button>
            </form>
          </section>

          <section className="tarjeta flex flex-col gap-3" aria-labelledby="h-importar">
            <h2 id="h-importar" className="text-lg font-bold">
              Importar desde Excel
            </h2>
            <p className="text-sm text-suave">
              Copie tres columnas (código, coeficiente, área m²) y péguelas aquí, una unidad por línea.
            </p>
            <form action={importarUnidades} className="flex flex-col gap-3">
              <label className="sr-only" htmlFor="lineas">
                Unidades a importar
              </label>
              <textarea id="lineas" name="lineas" rows={5} className="campo py-2 font-mono text-sm" placeholder={"A-101, 1.5625, 80\nA-102, 1.5625, 80"} required />
              <button className="btn-secundario">Importar</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
