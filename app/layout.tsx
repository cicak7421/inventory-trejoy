import "./globals.css";

export const metadata = {
  title: "Inventory System",
  description: "Sistem inventory multi-gudang",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
