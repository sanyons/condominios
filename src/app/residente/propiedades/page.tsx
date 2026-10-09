import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { formatos } from "@/lib/formato";
import { elegirCondominio } from "@/app/acciones-comunes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).propiedades.titulo };
}

type Propiedad = {
  condominio_id: string;
  condominio: string;
  moneda: string;
  unidad_id: string;
  codigo: string;
  tipo: string;
  relacion: string;
  es_responsable_pago: boolean;
  saldo_total: number;
  saldo_vencido: number;
  saldo_favor: number;
  condicion: string;
};

/** Todas las propiedades de la persona, en cualquier condominio, con su saldo. */
export default async function Propiedades() {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { dinero } = formatos(t);
  const p = t.propiedades;

  const { data } = await ctx.supabase.rpc("mis_propiedades");
  const lista: Propiedad[] = ((data ?? []) as any[]).map((r) => ({
    ...r,
    saldo_total: Number(r.saldo_total),
    saldo_vencido: Number(r.saldo_vencido),
    saldo_favor: Number(r.saldo_favor),
  }));

  const condos = Array.from(new Map(lista.map((r) => [r.condominio_id, r])).values());
  const total = (moneda: string) => lista.filter((r) => r.moneda === moneda).reduce((s, r) => s + r.saldo_total, 0);
  const crc = total("CRC");
  const usd = total("USD");
  const vencido = lista.some((r) => r.saldo_vencido > 0);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{p.titulo}</h1>
        {lista.length > 0 && <p className="text-sm text-suave">{p.subtitulo(lista.length, condos.length)}</p>}
      </div>

      {lista.length === 0 ? (
        <p className="tarjeta text-sm text-suave">{p.sinPropiedades}</p>
      ) : (
        <>
          <section aria-label={p.totalPendiente} className="flex flex-col gap-1.5 rounded-2xl bg-marca p-5 text-white">
            <span className="text-sm font-medium text-white/80">{p.totalPendiente}</span>
            <span className="text-3xl font-bold tracking-tight">{dinero(crc, "CRC")}</span>
            {usd > 0 && <span className="text-sm text-white/90">{p.enOtraMoneda(dinero(usd, "USD"))}</span>}
            {vencido && <span className="mt-1 self-start rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#0a5242]">{p.moroso}</span>}
          </section>

          {condos.map((c) => {
            const unidades = lista.filter((r) => r.condominio_id === c.condominio_id);
            const esActual = c.condominio_id === ctx.condominioId;
            return (
              <section key={c.condominio_id} className="tarjeta flex flex-col gap-3 p-4" aria-labelledby={`c-${c.condominio_id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`c-${c.condominio_id}`} className="font-bold">
                    {c.condominio}
                  </h2>
                  {esActual && <span className="pastilla tono-neutro shrink-0">{p.actual}</span>}
                </div>
                <ul className="flex flex-col divide-y divide-linea-suave">
                  {unidades.map((u) => (
                    <li key={u.unidad_id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {u.codigo} <span className="font-normal text-suave">· {t.tiposUnidad[u.tipo] ?? u.tipo}</span>
                        </p>
                        <p className="text-xs text-suave">
                          {t.relaciones[u.relacion] ?? u.relacion}
                          {u.es_responsable_pago && ` · ${p.responsable}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {u.saldo_total > 0 ? (
                          <span className={`text-sm font-bold ${u.saldo_vencido > 0 ? "text-peligro" : ""}`}>{dinero(u.saldo_total, u.moneda)}</span>
                        ) : (
                          <span className="pastilla tono-ok">{p.alDia}</span>
                        )}
                        {u.saldo_vencido > 0 && <span className="text-xs text-peligro-texto">{p.vencido(dinero(u.saldo_vencido, u.moneda))}</span>}
                        {u.saldo_favor > 0 && <span className="text-xs text-suave">{p.aFavor(dinero(u.saldo_favor, u.moneda))}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <form action={elegirCondominio}>
                    <input type="hidden" name="condominio_id" value={c.condominio_id} />
                    <input type="hidden" name="destino" value="/residente" />
                    <button className="btn-secundario min-h-10 w-full">{p.verEstado}</button>
                  </form>
                  <form action={elegirCondominio}>
                    <input type="hidden" name="condominio_id" value={c.condominio_id} />
                    <input type="hidden" name="destino" value="/residente/pagar" />
                    <button className="btn-suave min-h-10 w-full">{p.reportarPago}</button>
                  </form>
                </div>
              </section>
            );
          })}
          <p className="text-sm text-suave">{p.nota}</p>
        </>
      )}
    </>
  );
}
