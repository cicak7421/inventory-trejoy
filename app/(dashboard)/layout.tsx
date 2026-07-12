import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["super_admin", "admin", "staff_gudang", "staff_marketplace", "owner_viewer"] },
  { href: "/inventory", label: "Inventory Barang", roles: ["super_admin", "admin", "staff_gudang", "staff_marketplace", "owner_viewer"] },
  { href: "/transaksi", label: "Input Barang Masuk/Keluar", roles: ["super_admin", "admin", "staff_gudang"] },
  { href: "/transfer", label: "Transfer Antar Gudang", roles: ["super_admin", "admin", "staff_gudang"] },
  { href: "/sales-input", label: "Input Penjualan Marketplace", roles: ["super_admin", "admin", "staff_marketplace"] },
  { href: "/stock-opname", label: "Stock Opname", roles: ["super_admin", "admin", "staff_gudang"] },
  { href: "/audit-log", label: "Audit Log", roles: ["super_admin", "admin", "owner_viewer"] },
  { href: "/admin/users", label: "Kelola User", roles: ["super_admin", "admin"] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="font-semibold">Inventory System</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {profile.full_name} · {ROLE_LABEL[profile.role]}
            {profile.warehouses?.name ? ` · ${profile.warehouses.name}` : ""}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="p-3 border-t border-slate-100">
          <button className="w-full text-sm text-slate-500 hover:text-slate-800 rounded-lg px-3 py-2 hover:bg-slate-100 text-left">
            Keluar
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff_gudang: "Staff Gudang",
  staff_marketplace: "Staff Marketplace",
  owner_viewer: "Owner (Viewer)",
};
