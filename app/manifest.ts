import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Your Health Scanner",
    short_name: "Health Scanner",
    description:
      "Scan products and view ingredients, nutrition, allergens and simple health flags.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07140d",
    theme_color: "#43b96f",
    orientation: "portrait",
    categories: ["health", "food", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
