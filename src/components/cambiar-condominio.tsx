"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { elegirCondominio } from "@/app/acciones-comunes";

type Condo = { id: string; nombre: string };
type Item = Condo & { seccion: "recientes" | "todos" };

export type TextosSelector = {
  condominio: string;
  cambiar: string;
  buscar: string;
  recientes: string;
  todos: string;
  sinResultados: string;
  agregar: string;
  verCartera: string;
  atajo: string;
};

/** Ignora mayúsculas y tildes al buscar: "jose" encuentra "San José". */
function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CambiarCondominio({
  actual,
  condominios,
  recientes,
  puedeAgregar,
  mostrarCartera,
  textos,
}: {
  actual: Condo;
  condominios: Condo[];
  recientes: string[];
  puedeAgregar: boolean;
  mostrarCartera: boolean;
  textos: TextosSelector;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const [cargando, startTransition] = useTransition();
  const ruta = usePathname();
  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();

  const ordenados = useMemo(() => [...condominios].sort((a, b) => a.nombre.localeCompare(b.nombre)), [condominios]);

  const items: Item[] = useMemo(() => {
    const termino = normalizar(q.trim());
    if (termino) {
      return ordenados.filter((c) => normalizar(c.nombre).includes(termino)).map((c) => ({ ...c, seccion: "todos" as const }));
    }
    const rec = recientes
      .map((id) => condominios.find((c) => c.id === id))
      .filter((c): c is Condo => !!c)
      .map((c) => ({ ...c, seccion: "recientes" as const }));
    const usarRecientes = condominios.length > 6 && rec.length > 0;
    return [...(usarRecientes ? rec : []), ...ordenados.map((c) => ({ ...c, seccion: "todos" as const }))];
  }, [q, ordenados, recientes, condominios]);

  // Ctrl/Cmd + K abre el selector desde cualquier parte
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Al abrir: limpiar búsqueda y enfocar; clic afuera cierra
  useEffect(() => {
    if (!abierto) return;
    setQ("");
    setActivo(0);
    requestAnimationFrame(() => entrada.current?.focus());
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Mantener visible la opción activa al moverse con el teclado
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  function elegir(id: string) {
    setAbierto(false);
    if (id === actual.id) return;
    const fd = new FormData();
    fd.set("condominio_id", id);
    fd.set("destino", ruta.startsWith("/admin/condominios") || ruta === "/onboarding" ? "/admin" : ruta);
    startTransition(() => elegirCondominio(fd));
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[activo]) elegir(items[activo].id);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={textos.cambiar}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-linea bg-superficie px-3 py-2.5 text-left hover:border-campo"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-wide text-suave uppercase">{textos.condominio}</span>
          <span className={`block text-sm leading-snug font-semibold ${cargando ? "opacity-60" : ""}`}>{actual.nombre}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-suave">
          <kbd className="hidden rounded border border-linea px-1.5 py-0.5 font-sans text-[10px] font-semibold lg:inline">{textos.atajo}</kbd>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
          </svg>
        </span>
      </button>

      {abierto && (
        <div className="absolute inset-x-0 z-40 mt-1 flex max-h-[min(28rem,70vh)] flex-col rounded-lg border border-linea bg-superficie shadow-lg lg:w-80">
          <div className="border-b border-linea p-2">
            <input
              ref={entrada}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActivo(0);
              }}
              onKeyDown={teclado}
              role="combobox"
              aria-expanded="true"
              aria-controls={idLista}
              aria-activedescendant={items[activo] ? `${idLista}-${activo}` : undefined}
              aria-label={textos.buscar}
              placeholder={textos.buscar}
              className="campo min-h-10"
            />
          </div>
          <ul ref={lista} id={idLista} role="listbox" aria-label={textos.condominio} className="min-h-0 flex-1 overflow-y-auto p-1">
            {items.length === 0 && <li className="px-3 py-3 text-sm text-suave">{textos.sinResultados}</li>}
            {items.map((c, i) => {
              const primeroDeSeccion = i === 0 || items[i - 1].seccion !== c.seccion;
              const mostrarTitulo = !q.trim() && primeroDeSeccion && items.some((x) => x.seccion === "recientes");
              return (
                <li key={`${c.seccion}-${c.id}`} role="presentation">
                  {mostrarTitulo && (
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-suave uppercase" aria-hidden="true">
                      {c.seccion === "recientes" ? textos.recientes : textos.todos}
                    </p>
                  )}
                  <div
                    id={`${idLista}-${i}`}
                    data-indice={i}
                    role="option"
                    aria-selected={i === activo}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(c.id)}
                    className={`flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm leading-snug ${
                      i === activo ? "bg-linea-suave" : ""
                    } ${c.id === actual.id ? "font-bold text-acento-fuerte" : "font-medium"}`}
                  >
                    <span>{c.nombre}</span>
                    {c.id === actual.id && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {(mostrarCartera || puedeAgregar) && (
            <div className="flex flex-col border-t border-linea p-1">
              {mostrarCartera && (
                <Link
                  href="/admin/condominios"
                  onClick={() => setAbierto(false)}
                  className="flex min-h-10 items-center rounded-md px-3 text-sm font-semibold text-acento hover:bg-linea-suave"
                >
                  {textos.verCartera}
                </Link>
              )}
              {puedeAgregar && (
                <Link
                  href="/onboarding"
                  onClick={() => setAbierto(false)}
                  className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-acento hover:bg-linea-suave"
                >
                  <span aria-hidden="true">+</span> {textos.agregar}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
