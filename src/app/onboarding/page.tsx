import Link from "next/link";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { obtenerContexto } from "@/lib/contexto";
import { crearCondominio } from "@/app/acciones-comunes";
import { cerrarSesion } from "@/app/(auth)/acciones";

export const metadata = { title: "Configurar condominio" };

const PROVINCIAS = ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"];

export default async function Onboarding({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  const ctx = await obtenerContexto();
  const tieneCondominios = ctx.condominios.length > 0;
  return (
    <MarcoAuth titulo={tieneCondominios ? "Agregar otro condominio" : "Registre su condominio"}>
      {tieneCondominios && (
        <p className="text-sm text-suave">
          Quedará como administrador del nuevo condominio. Para cambiar entre condominios use el selector del menú.{" "}
          <Link href="/" className="font-semibold text-marca">
            Volver al panel
          </Link>
        </p>
      )}
      {!tieneCondominios && (
        <p className="text-sm text-suave">
          Si usted es residente, su administración debe invitarle por correo. Si administra un condominio, regístrelo aquí.
        </p>
      )}
      <Aviso error={error} />
      <form action={crearCondominio} className="flex flex-col gap-4">
        <label className="etiqueta">
          Nombre del condominio
          <input className="campo" name="nombre" placeholder="Condominio Las Palmas" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="etiqueta">
            Provincia
            <select className="campo" name="provincia" defaultValue="San José">
              {PROVINCIAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="etiqueta">
            Cantón
            <input className="campo" name="canton" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="etiqueta">
            Moneda
            <select className="campo" name="moneda" defaultValue="CRC">
              <option value="CRC">Colones</option>
              <option value="USD">Dólares</option>
            </select>
          </label>
          <label className="etiqueta">
            Día de pago
            <input className="campo" type="number" name="dia_vencimiento" min={1} max={28} defaultValue={10} />
          </label>
          <label className="etiqueta">
            Mora % mes
            <input className="campo" type="number" name="tasa_mora" min={0} max={10} step="0.01" defaultValue={2} />
          </label>
        </div>
        <button className="btn-primario">Crear condominio</button>
      </form>
      <form action={cerrarSesion}>
        <button className="text-sm font-semibold text-suave underline">Cerrar sesión ({ctx.user.email})</button>
      </form>
    </MarcoAuth>
  );
}
