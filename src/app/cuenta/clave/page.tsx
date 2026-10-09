import type { Metadata } from "next";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dic } from "@/lib/i18n";
import { cambiarClave } from "@/app/(auth)/acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).auth.tituloClave };
}

export default async function Clave({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const t = await dic();
  return (
    <MarcoAuth titulo={t.auth.tituloClave}>
      <Aviso error={error} />
      <form action={cambiarClave} className="flex flex-col gap-4">
        <label className="etiqueta">
          {t.auth.nuevaClave}
          <input className="campo" type="password" name="password" minLength={8} autoComplete="new-password" required />
        </label>
        <button className="btn-primario">{t.auth.guardarYContinuar}</button>
      </form>
    </MarcoAuth>
  );
}
