import { contextoAdmin } from "@/lib/contexto";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { guardarCondominio, agregarCuenta, desactivarCuenta } from "./acciones";

export const metadata = { title: "Configuración" };

export default async function Ajustes({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  const ctx = await contextoAdmin();
  const esAdmin = ctx.roles.includes("administrador");
  const [{ data: c }, { data: cuentas }] = await Promise.all([
    ctx.supabase.from("condominios").select("*").eq("id", ctx.condominioId).single(),
    ctx.supabase.from("cuentas_bancarias").select("*").eq("condominio_id", ctx.condominioId).eq("activa", true),
  ]);

  return (
    <>
      <Encabezado titulo="Configuración" />
      <Aviso ok={ok} error={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-datos">
          <h2 id="h-datos" className="text-lg font-bold">
            Datos del condominio
          </h2>
          <form action={guardarCondominio} className="grid grid-cols-2 gap-3">
            <label className="etiqueta col-span-2">
              Nombre
              <input className="campo" name="nombre" defaultValue={c?.nombre} required />
            </label>
            <label className="etiqueta">
              Cédula jurídica
              <input className="campo" name="cedula_juridica" defaultValue={c?.cedula_juridica ?? ""} />
            </label>
            <label className="etiqueta">
              Día de vencimiento
              <input className="campo" type="number" name="dia_vencimiento" min={1} max={28} defaultValue={c?.dia_vencimiento} />
            </label>
            <label className="etiqueta">
              Días de gracia
              <input className="campo" type="number" name="dias_gracia" min={0} max={60} defaultValue={c?.dias_gracia} />
            </label>
            <label className="etiqueta">
              Interés de mora (% mensual)
              <input className="campo" type="number" name="tasa_mora_mensual" min={0} max={10} step="0.01" defaultValue={c?.tasa_mora_mensual} />
            </label>
            <label className="etiqueta col-span-2">
              Dirección
              <input className="campo" name="direccion" defaultValue={c?.direccion ?? ""} />
            </label>
            <button className="btn-primario col-span-2" disabled={!esAdmin}>
              Guardar
            </button>
          </form>
        </section>

        <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-cuentas">
          <h2 id="h-cuentas" className="text-lg font-bold">
            Cuentas para recibir pagos
          </h2>
          {(cuentas ?? []).length === 0 ? (
            <p className="text-sm text-suave">Agregue al menos una cuenta o número SINPE Móvil.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(cuentas ?? []).map((k: any) => (
                <li key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-linea p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {k.banco} · {k.moneda}
                    </p>
                    <p className="truncate text-suave">{k.iban}</p>
                    {k.sinpe_movil && <p className="text-suave">SINPE Móvil {k.sinpe_movil}</p>}
                  </div>
                  <form action={desactivarCuenta}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="text-sm font-semibold text-suave hover:text-peligro">Quitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={agregarCuenta} className="grid grid-cols-2 gap-3 border-t border-linea pt-4">
            <label className="etiqueta">
              Banco
              <input className="campo" name="banco" required />
            </label>
            <label className="etiqueta">
              Moneda
              <select className="campo" name="moneda" defaultValue="CRC">
                <option value="CRC">Colones</option>
                <option value="USD">Dólares</option>
              </select>
            </label>
            <label className="etiqueta col-span-2">
              IBAN
              <input className="campo" name="iban" placeholder="CR00 0000 0000 0000 0000 00" required />
            </label>
            <label className="etiqueta">
              SINPE Móvil
              <input className="campo" name="sinpe_movil" inputMode="tel" />
            </label>
            <label className="etiqueta">
              Titular
              <input className="campo" name="titular" defaultValue={c?.nombre} required />
            </label>
            <button className="btn-secundario col-span-2">Agregar cuenta</button>
          </form>
        </section>
      </div>
    </>
  );
}
