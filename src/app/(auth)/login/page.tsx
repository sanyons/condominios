import Link from "next/link";
import type { Metadata } from "next";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { dic } from "@/lib/i18n";
import { iniciarSesion, enviarEnlaceRecuperacion } from "../acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).auth.tituloLogin };
}

export default async function Login({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const t = await dic();
  return (
    <MarcoAuth titulo={t.auth.tituloLogin}>
      <Aviso ok={ok} error={error} />
      <form action={iniciarSesion} className="flex flex-col gap-4">
        <label className="etiqueta">
          {t.comun.correo}
          <input className="campo" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="etiqueta">
          {t.comun.contrasena}
          <input className="campo" type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn-primario">{t.auth.entrar}</button>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-acento">{t.auth.olvido}</summary>
        <form action={enviarEnlaceRecuperacion} className="mt-3 flex flex-col gap-3">
          <label className="etiqueta">
            {t.comun.correo}
            <input className="campo" type="email" name="email" required />
          </label>
          <button className="btn-secundario">{t.auth.enviarEnlace}</button>
        </form>
      </details>
      <p className="text-sm text-suave">
        {t.auth.sinCuenta}{" "}
        <Link href="/registro" className="font-semibold text-acento">
          {t.auth.crearCuenta}
        </Link>
      </p>
    </MarcoAuth>
  );
}
