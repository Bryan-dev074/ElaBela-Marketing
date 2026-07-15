import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import InteractiveBackground from "@/components/InteractiveBackground";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ElaBela · Marketing & Growth Platform",
  description:
    "Plataforma interna de marketing de ElaBela: calendario, tareas, proyectos, guiones, HUB de clientes y recursos de marca.",
};

export const viewport: Viewport = {
  themeColor: "#160d0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <InteractiveBackground />
        {children}
      </body>
    </html>
  );
}
