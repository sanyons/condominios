"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavEnlace({ href, children, exacto = false }: { href: string; children: React.ReactNode; exacto?: boolean }) {
  const ruta = usePathname();
  const activo = exacto ? ruta === href : ruta === href || ruta.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${
        activo ? "bg-marca-clara font-bold text-acento-fuerte" : "font-medium text-tenue hover:bg-linea-suave"
      }`}
    >
      {children}
    </Link>
  );
}
