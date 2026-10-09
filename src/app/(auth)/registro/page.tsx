import Link from "next/link";
import type { Metadata } from "next";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dic } from "@/lib/i18n";
import { registrarse } from "../acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).auth.crearCuenta };
}

export default async function Registro({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const t = await dic();
  return (
    <MarcoAuth titulo={t.auth.tituloRegistro}>
      <p className="text-sm text-suave">{t.auth.notaRegistro}</p>
      <Aviso error={error} />
      <form action={registrarse} className="flex flex-col gap-4">
        <label className="etiqueta">
          {t.comun.nombre}
          <input className="campo" name="nombre" autoComplete="name" required />
        </label>
        <label className="etiqueta">
          {t.comun.correo}
          <input className="campo" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="etiqueta">
          {t.auth.claveMinima}
          <input className="campo" type="password" name="password" minLength={8} autoComplete="new-password" required />
        </label>
        <button className="btn-primario">{t.auth.crearCuenta}</button>
      </form>
      <p className="text-sm text-suave">
        {t.auth.yaTieneCuenta}{" "}
        <Link href="/login" className="font-semibold text-acento">
          {t.auth.tituloLogin}
        </Link>
      </p>
    </MarcoAuth>
  );
}
