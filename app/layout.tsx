import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Your Health Scanner",
  description:
    "Scan a barcode, search product data and facts and show ingredients, nutrition, allergens and simple health flags.",
  applicationName: "Your Health Scanner",
  authors: [{ name: 'Robert "Rob-One" Wägar' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Your Health Scanner",
  },
};

export const viewport: Viewport = {
  themeColor: "#43b96f",
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
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
