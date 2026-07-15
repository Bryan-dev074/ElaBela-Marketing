import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import InteractiveBackground from "@/components/InteractiveBackground";
import CustomCursor from "@/components/CustomCursor";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ElaBela · Marketing & Growth Platform",
  description:
    "Plataforma interna de marketing de ElaBela: calendario, tareas, proyectos, guiones, HUB de clientes y recursos de marca.",
  icons: { icon: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <InteractiveBackground />
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
