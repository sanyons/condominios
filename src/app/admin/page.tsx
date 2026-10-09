import Link from "next/link";
import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).panel.titulo };
}

function inicioMes(locale: string) {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
  const y = ahora.getFullYear();
  const m = ahora.getMonth();
  const desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const sig = new Date(y, m + 1, 1);
  const hasta = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, "0")}-01`;
  const nombre = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(ahora);
  return { desde, hasta, nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
}

export default async function Panel({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { dinero, fecha } = formatos(t);
  const { supabase, condominioId } = ctx;
  const mes = inicioMes(t.locale);

  const [condo, unidades, estado, cargosMes, pagosMes, enRevision] = await Promise.all([
    supabase.from("condominios").select("moneda_base").eq("id", condominioId).single(),
    supabase.from("unidades").select("id", { count: "exact", head: true }).eq("condominio_id", condominioId),
    supabase
      .from("v_estado_cuenta_unidad")
      .select("unidad_id, codigo, saldo_vencido, vencido_desde, condicion")
      .eq("condominio_id", condominioId),
    supabase.from("cargos").select("monto").eq("condominio_id", condominioId).eq("periodo", mes.desde).neq("estado", "anulado"),
    supabase
      .from("pagos")
      .select("monto")
      .eq("condominio_id", condominioId)
      .eq("estado", "aplicado")
      .gte("fecha_pago", mes.desde)
      .lt("fecha_pago", mes.hasta),
    supabase
      .from("pagos")
      .select("id, monto, moneda, metodo, fecha_pago, unidades(codigo), usuarios!pagos_pagado_por_fkey(nombre, apellidos)", {
        count: "exact",
      })
      .eq("condominio_id", condominioId)
      .eq("estado", "en_revision")
      .order("creado_en", { ascending: true })
      .limit(5),
  ]);

  const moneda = condo.data?.moneda_base ?? "CRC";
  const suma = (filas: { monto: number | string }[] | null) => (filas ?? []).reduce((s, f) => s + Number(f.monto), 0);
  const facturado = suma(cargosMes.data);
  const recaudado = suma(pagosMes.data);
  const pct = facturado > 0 ? Math.min(100, Math.round((recaudado / facturado) * 100)) : 0;
  const morosos = (estado.data ?? []).filter((e: any) => e.condicion === "moroso");
  const totalMora = morosos.reduce((s: number, e: any) => s + Number(e.saldo_vencido), 0);
  const peores = [...morosos].sort((a: any, b: any) => Number(b.saldo_vencido) - Number(a.saldo_vencido)).slice(0, 5);
  const totalUnidades = unidades.count ?? 0;

  return (
    <>
      <Encabezado titulo={mes.nombre} subtitulo={t.panel.subtitulo(ctx.condominioNombre, totalUnidades)}>
        <Link href="/admin/cobros" className="btn-primario">
          {t.panel.generarCuotas}
        </Link>
      </Encabezado>
      <Aviso ok={ok} error={error} />

      {totalUnidades === 0 && (
        <div className="tarjeta flex flex-wrap items-center justify-between gap-4 border-marca bg-marca-clara">
          <p className="text-sm font-medium text-acento-fuerte">{t.panel.primerPaso}</p>
          <Link href="/admin/unidades" className="btn-primario">
            {t.panel.agregarUnidades}
          </Link>
        </div>
      )}

      <section aria-label={t.panel.indicadores} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.panel.recaudado}</span>
          <span className="text-2xl font-bold tracking-tight">{dinero(recaudado, moneda)}</span>
          <div className="h-2 overflow-hidden rounded-full bg-linea-suave">
            <div className="h-2 bg-marca" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-suave">{t.panel.deFacturado(pct, dinero(facturado, moneda))}</span>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.panel.morosidad}</span>
          <span className="text-2xl font-bold tracking-tight text-peligro">{dinero(totalMora, moneda)}</span>
          <span className="text-sm text-suave">{t.panel.unidadesVencidas(morosos.length)}</span>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.panel.porRevisar}</span>
          <span className="text-2xl font-bold tracking-tight text-alerta">{enRevision.count ?? 0}</span>
          <Link href="/admin/pagos" className="text-sm font-semibold text-acento">
            {t.panel.revisarAhora}
          </Link>
        </div>
        <div className="tarjeta flex flex-col gap-2.5">
          <span className="text-sm font-medium text-suave">{t.panel.alDia}</span>
          <span className="text-2xl font-bold tracking-tight">
            {totalUnidades - morosos.length} / {totalUnidades}
          </span>
          <Link href="/admin/unidades" className="text-sm font-semibold text-acento">
            {t.panel.verUnidades}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section aria-labelledby="h-rev" className="tarjeta flex flex-col gap-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 id="h-rev" className="text-lg font-bold">
              {t.panel.pagosReportados}
            </h2>
            <Link href="/admin/pagos" className="text-sm font-semibold text-acento">
              {t.comun.verTodos}
            </Link>
          </div>
          {(enRevision.data ?? []).length === 0 ? (
            <p className="text-sm text-suave">{t.panel.sinPendientes}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla min-w-[520px]">
                <thead>
                  <tr>
                    <th>{t.comun.unidad}</th>
                    <th>{t.panel.residente}</th>
                    <th>{t.comun.metodo}</th>
                    <th className="text-right">{t.comun.monto}</th>
                    <th>{t.comun.fecha}</th>
                  </tr>
                </thead>
                <tbody>
                  {(enRevision.data ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.unidades?.codigo}</td>
                      <td>{[p.usuarios?.nombre, p.usuarios?.apellidos].filter(Boolean).join(" ") || "—"}</td>
                      <td className="text-suave">{t.metodos[p.metodo] ?? p.metodo}</td>
                      <td className="text-right font-semibold">{dinero(p.monto, p.moneda)}</td>
                      <td className="text-suave">{fecha(p.fecha_pago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="h-mor" className="tarjeta flex flex-col gap-4">
          <h2 id="h-mor" className="text-lg font-bold">
            {t.panel.mayoresSaldos}
          </h2>
          {peores.length === 0 ? (
            <p className="text-sm text-suave">{t.panel.todosAlDia}</p>
          ) : (
            <ul className="flex flex-col">
              {peores.map((e: any) => (
                <li key={e.unidad_id} className="flex items-center justify-between border-b border-linea-suave py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{e.codigo}</span>
                    <span className="text-suave"> · {t.panel.desde(fecha(e.vencido_desde))}</span>
                  </span>
                  <span className="font-semibold text-peligro">{dinero(e.saldo_vencido, moneda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
