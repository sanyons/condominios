"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONOS: Record<string, React.ReactNode> = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pagar: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6.5 15h4" />
    </>
  ),
  reservas: (
    <>
      <path d="M4 20h16M6 20V10l6-5 6 5v10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  documentos: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
};

export function NavInferior({ items, etiqueta }: { items: { href: string; texto: string; icono: string }[]; etiqueta: string }) {
  const ruta = usePathname();
  return (
    <nav aria-label={etiqueta} className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const activo = it.href === "/residente" ? ruta === it.href : ruta === it.href || ruta.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={activo ? "page" : undefined}
              className={`flex min-h-15 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${
                activo ? "text-acento-fuerte" : "text-suave hover:text-tinta"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={activo ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONOS[it.icono]}
              </svg>
              <span className="max-w-full truncate">{it.texto}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
