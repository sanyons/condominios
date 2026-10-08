import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vecindo — Administración de condominios",
    short_name: "Vecindo",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F5F1",
    theme_color: "#0E6B57",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
