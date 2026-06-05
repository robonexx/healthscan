import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Product Scanner PWA",
  description: "Scan products and read food information from Open Food Facts.",
  applicationName: "Product Scanner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Product Scanner",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
