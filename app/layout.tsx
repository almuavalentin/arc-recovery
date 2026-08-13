import "./globals.css";

export const metadata = {
  title: "ARC Recovery",
  description: "Gestión de turnos de recovery del equipo",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#161616"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
