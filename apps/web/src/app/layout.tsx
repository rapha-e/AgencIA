import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AdMetrics & Growth AI | Plataforma de Growth Marketing",
  description: "Sistema operacional de Growth Marketing com IA e Governança de Tráfego Pago",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-blue-500/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
