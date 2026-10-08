import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Comprobantes de pago (fotos) suben por acciones del servidor
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
