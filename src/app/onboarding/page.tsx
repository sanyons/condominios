import Link from "next/link";
import type { Metadata } from "next";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { obtenerContexto } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { crearCondominio } from "@/app/acciones-comunes";
import { cerrarSesion } from "@/app/(auth)/acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).onboarding.tituloNuevo };
}

export default async function Onboarding({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const [ctx, t] = await Promise.all([obtenerContexto(), dic()]);
  const tieneCondominios = ctx.condominios.length > 0;
  return (
    <MarcoAuth titulo={tieneCondominios ? t.onboarding.tituloOtro : t.onboarding.tituloNuevo}>
      {tieneCondominios ? (
        <p className="text-sm text-suave">
          {t.onboarding.notaOtro}{" "}
          <Link href="/" className="font-semibold text-acento">
            {t.onboarding.volverPanel}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-suave">{t.onboarding.notaNuevo}</p>
      )}
      <Aviso error={error} />
      <form action={crearCondominio} className="flex flex-col gap-4">
        <label className="etiqueta">
          {t.onboarding.nombre}
          <input className="campo" name="nombre" placeholder={t.onboarding.nombreEjemplo} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="etiqueta">
            {t.onboarding.provincia}
            <select className="campo" name="provincia" defaultValue="San José">
              {t.provincias.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="etiqueta">
            {t.onboarding.canton}
            <input className="campo" name="canton" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="etiqueta">
            {t.comun.moneda}
            <select className="campo" name="moneda" defaultValue="CRC">
              <option value="CRC">{t.comun.colones}</option>
              <option value="USD">{t.comun.dolares}</option>
            </select>
          </label>
          <label className="etiqueta">
            {t.onboarding.diaPago}
            <input className="campo" type="number" name="dia_vencimiento" min={1} max={28} defaultValue={10} />
          </label>
          <label className="etiqueta">
            {t.onboarding.moraMes}
            <input className="campo" type="number" name="tasa_mora" min={0} max={10} step="0.01" defaultValue={2} />
          </label>
        </div>
        <button className="btn-primario">{t.onboarding.crear}</button>
      </form>
      <form action={cerrarSesion}>
        <button className="text-sm font-semibold text-suave underline">{t.onboarding.cerrarSesion(ctx.user.email ?? "")}</button>
      </form>
    </MarcoAuth>
  );
}
