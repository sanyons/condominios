import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic, type Dict } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { diaCR, fechaCorta, hora, horaDeTexto } from "@/lib/fechas";
import { cancelarReservaAdmin, eliminarArea, guardarArea, reservarParaUnidad, responderReserva } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).amenidades.titulo };
}

type Area = {
  id: string;
  nombre: string;
  descripcion: string | null;
  capacidad: number | null;
  costo: number;
  deposito: number;
  requiere_aprobacion: boolean;
  hora_apertura: string;
  hora_cierre: string;
  duracion_max_horas: number;
  reservas_max_mes: number | null;
  bloquear_morosos: boolean;
  reglas: string | null;
  activa: boolean;
};

const CASILLA = "size-5 shrink-0 accent-[var(--marca)]";

function FormularioArea({ t, area }: { t: Dict; area?: Area }) {
  const a = t.amenidades;
  return (
    <form action={guardarArea} className="flex flex-col gap-3">
      {area && <input type="hidden" name="id" value={area.id} />}
      <label className="etiqueta">
        {a.nombre}
        <input className="campo" name="nombre" required maxLength={80} defaultValue={area?.nombre} placeholder={a.nombreEjemplo} />
      </label>
      <label className="etiqueta">
        {a.descripcion}
        <input className="campo" name="descripcion" maxLength={200} defaultValue={area?.descripcion ?? ""} />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="etiqueta">
          {a.apertura}
          <input className="campo" type="time" name="hora_apertura" required defaultValue={area?.hora_apertura.slice(0, 5) ?? "08:00"} />
        </label>
        <label className="etiqueta">
          {a.cierre}
          <input className="campo" type="time" name="hora_cierre" required defaultValue={area?.hora_cierre.slice(0, 5) ?? "22:00"} />
        </label>
        <label className="etiqueta">
          {a.duracionMax}
          <input className="campo" type="number" min={1} max={24} name="duracion_max_horas" defaultValue={area?.duracion_max_horas ?? 4} />
        </label>
        <label className="etiqueta">
          {a.capacidad}
          <input className="campo" type="number" min={1} name="capacidad" defaultValue={area?.capacidad ?? ""} />
        </label>
        <label className="etiqueta">
          {a.costo}
          <input className="campo" type="number" min={0} step="any" name="costo" defaultValue={area?.costo ?? 0} />
        </label>
        <label className="etiqueta">
          {a.deposito}
          <input className="campo" type="number" min={0} step="any" name="deposito" defaultValue={area?.deposito ?? 0} />
        </label>
        <label className="etiqueta col-span-2">
          {a.maxMes}
          <input className="campo" type="number" min={1} name="reservas_max_mes" placeholder={a.sinLimite} defaultValue={area?.reservas_max_mes ?? ""} />
        </label>
      </div>
      <label className="etiqueta">
        {a.reglas}
        <textarea className="campo min-h-20 py-2" name="reglas" rows={3} defaultValue={area?.reglas ?? ""} placeholder={a.reglasEjemplo} />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" name="requiere_aprobacion" defaultChecked={area?.requiere_aprobacion ?? false} className={CASILLA} />
          {a.requiereAprobacion}
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" name="bloquear_morosos" defaultChecked={area?.bloquear_morosos ?? true} className={CASILLA} />
          {a.bloquearMorosos}
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" name="activa" defaultChecked={area?.activa ?? true} className={CASILLA} />
          {a.activa}
        </label>
      </div>
      <button className="btn-primario self-start">{area ? a.guardar : a.crear}</button>
    </form>
  );
}

export default async function Amenidades({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { dinero } = formatos(t);
  const { supabase, condominioId } = ctx;
  const a = t.amenidades;

  const [{ data: areas }, { data: reservas }, { data: unidades }, { data: condo }] = await Promise.all([
    supabase.from("areas_comunes").select("*").eq("condominio_id", condominioId).order("nombre"),
    supabase
      .from("reservas")
      .select("id, inicio, fin, estado, invitados, notas, areas_comunes(nombre), unidades(codigo), usuarios!reservas_usuario_id_fkey(nombre, apellidos)")
      .eq("condominio_id", condominioId)
      .in("estado", ["solicitada", "confirmada"])
      .gte("fin", new Date().toISOString())
      .order("inicio")
      .limit(100),
    supabase.from("unidades").select("id, codigo").eq("condominio_id", condominioId).order("codigo"),
    supabase.from("condominios").select("moneda_base").eq("id", condominioId).single(),
  ]);

  const moneda = condo?.moneda_base ?? "CRC";
  const lista = (areas ?? []) as Area[];
  const pendientes = (reservas ?? []).filter((r: any) => r.estado === "solicitada");
  const confirmadas = (reservas ?? []).filter((r: any) => r.estado === "confirmada");
  const cuando = (r: any) => `${fechaCorta(diaCR(r.inicio), t.locale)} · ${hora(r.inicio, t.locale)} – ${hora(r.fin, t.locale)}`;
  const persona = (r: any) => [r.usuarios?.nombre, r.usuarios?.apellidos].filter(Boolean).join(" ");

  return (
    <>
      <Encabezado titulo={a.titulo} subtitulo={a.subtitulo(lista.length)} />
      <Aviso ok={ok} error={error} />

      {pendientes.length > 0 && (
        <section className="tarjeta flex flex-col gap-3" aria-labelledby="h-pend">
          <h2 id="h-pend" className="flex items-center gap-2 text-lg font-bold">
            {a.porAprobar} <span className="pastilla tono-alerta">{pendientes.length}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-linea-suave">
            {pendientes.map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {r.areas_comunes?.nombre} · {r.unidades?.codigo}
                  </p>
                  <p className="text-sm text-suave">{cuando(r)}</p>
                  <p className="text-xs text-suave">
                    {persona(r)}
                    {r.invitados ? ` · ${a.invitados(r.invitados)}` : ""}
                    {r.notas ? ` · “${r.notas}”` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={responderReserva}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="aprobar" value="1" />
                    <button className="btn-primario min-h-10">{a.aprobar}</button>
                  </form>
                  <form action={responderReserva} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="aprobar" value="0" />
                    <label className="sr-only" htmlFor={`m-${r.id}`}>
                      {a.motivo}
                    </label>
                    <input id={`m-${r.id}`} name="motivo" placeholder={a.motivo} className="campo min-h-10 w-44" />
                    <button className="btn-peligro min-h-10">{a.rechazar}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta flex flex-col gap-3" aria-labelledby="h-prox">
        <h2 id="h-prox" className="text-lg font-bold">
          {a.proximas}
        </h2>
        {confirmadas.length === 0 ? (
          <p className="text-sm text-suave">{a.sinProximas}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[640px]">
              <thead>
                <tr>
                  <th>{t.comun.fecha}</th>
                  <th>{a.nombre}</th>
                  <th>{t.comun.unidad}</th>
                  <th>{t.comun.nombre}</th>
                  <th>
                    <span className="sr-only">{a.cancelar}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {confirmadas.map((r: any) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{cuando(r)}</td>
                    <td className="font-semibold">{r.areas_comunes?.nombre}</td>
                    <td>{r.unidades?.codigo}</td>
                    <td className="text-suave">
                      {persona(r)}
                      {r.invitados ? <span className="block text-xs">{a.invitados(r.invitados)}</span> : null}
                    </td>
                    <td className="text-right">
                      <form action={cancelarReservaAdmin}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn-secundario min-h-9 px-3 text-xs whitespace-nowrap">{a.cancelar}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-areas">
        <h2 id="h-areas" className="text-lg font-bold">
          {a.areas}
        </h2>
        {lista.length === 0 ? (
          <p className="tarjeta text-sm text-suave">{a.sinAreas}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {lista.map((ar) => (
              <article key={ar.id} className={`tarjeta flex flex-col gap-3 ${ar.activa ? "" : "opacity-75"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold">{ar.nombre}</h3>
                    {ar.descripcion && <p className="text-sm text-suave">{ar.descripcion}</p>}
                  </div>
                  <span className={`pastilla shrink-0 ${ar.activa ? "tono-ok" : "tono-neutro"}`}>{ar.activa ? a.activa : a.inactiva}</span>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  <li className="pastilla tono-neutro">
                    {a.horario(horaDeTexto(ar.hora_apertura, t.locale), horaDeTexto(ar.hora_cierre, t.locale))}
                  </li>
                  <li className="pastilla tono-neutro">{a.maxHoras(ar.duracion_max_horas)}</li>
                  <li className="pastilla tono-neutro">{Number(ar.costo) > 0 ? dinero(ar.costo, moneda) : a.gratis}</li>
                  {Number(ar.deposito) > 0 && <li className="pastilla tono-neutro">{a.depositoN(dinero(ar.deposito, moneda))}</li>}
                  {ar.capacidad && <li className="pastilla tono-neutro">{a.capacidadN(ar.capacidad)}</li>}
                  {ar.reservas_max_mes && <li className="pastilla tono-neutro">{a.porMes(ar.reservas_max_mes)}</li>}
                  {ar.requiere_aprobacion && <li className="pastilla tono-alerta">{a.conAprobacion}</li>}
                </ul>
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-acento">{a.editar}</summary>
                  <div className="mt-3 flex flex-col gap-4 border-t border-linea pt-3">
                    <FormularioArea t={t} area={ar} />
                    <form action={eliminarArea}>
                      <input type="hidden" name="id" value={ar.id} />
                      <button className="text-sm font-semibold text-peligro-texto hover:underline">{a.eliminar}</button>
                    </form>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-nueva">
          <h2 id="h-nueva" className="text-lg font-bold">
            {a.nuevaArea}
          </h2>
          <FormularioArea t={t} />
        </section>

        {lista.some((x) => x.activa) && (
          <section className="tarjeta flex flex-col gap-4 self-start" aria-labelledby="h-reservar">
            <h2 id="h-reservar" className="text-lg font-bold">
              {a.reservarPorUnidad}
            </h2>
            <p className="text-sm text-suave">{a.notaReservarAdmin}</p>
            <form action={reservarParaUnidad} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="etiqueta">
                  {a.nombre}
                  <select className="campo" name="area_id" required>
                    {lista
                      .filter((x) => x.activa)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                        </option>
                      ))}
                  </select>
                </label>
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
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="etiqueta">
                  {t.reservar.fecha}
                  <input className="campo" type="date" name="fecha" required defaultValue={diaCR(new Date())} />
                </label>
                <label className="etiqueta">
                  {t.reservar.desde}
                  <input className="campo" type="time" name="desde" step={900} required defaultValue="10:00" />
                </label>
                <label className="etiqueta">
                  {t.reservar.hasta}
                  <input className="campo" type="time" name="hasta" step={900} required defaultValue="12:00" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="etiqueta">
                  {t.reservar.invitados}
                  <input className="campo" type="number" min={0} name="invitados" defaultValue={0} />
                </label>
                <label className="etiqueta col-span-2">
                  {t.reservar.notas}
                  <input className="campo" name="notas" maxLength={200} />
                </label>
              </div>
              <button className="btn-primario self-start">{a.reservar}</button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
