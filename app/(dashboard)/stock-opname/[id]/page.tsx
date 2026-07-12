import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { approveStockOpname } from "@/lib/actions/stockOpname";

export default async function OpnameDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  const { data: session } = await supabase
    .from("stock_opname_sessions")
    .select("*, warehouses(name), profiles:created_by(full_name)")
    .eq("id", params.id)
    .single();

  const { data: lines } = await supabase
    .from("stock_opname_lines")
    .select("*, items(sku,name)")
    .eq("session_id", params.id);

  const isAdmin = profile && ["admin", "super_admin"].includes(profile.role);

  async function approve() {
    "use server";
    await approveStockOpname(params.id);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Detail Stock Opname</h1>
        <p className="text-slate-500 text-sm mt-1">
          {session?.warehouses?.name} · dibuat oleh {session?.profiles?.full_name} · {session?.opname_date}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3 text-right">Stok Sistem</th>
              <th className="px-4 py-3 text-right">Stok Aktual</th>
              <th className="px-4 py-3 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((l: any) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{l.items?.sku}</td>
                <td className="px-4 py-2">{l.items?.name}</td>
                <td className="px-4 py-2 text-right text-slate-500">{l.qty_system}</td>
                <td className="px-4 py-2 text-right">{l.qty_actual}</td>
                <td className={`px-4 py-2 text-right font-medium ${l.selisih === 0 ? "text-slate-400" : l.selisih > 0 ? "text-green-600" : "text-red-600"}`}>
                  {l.selisih > 0 ? `+${l.selisih}` : l.selisih}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {session?.status === "submitted" && isAdmin && (
        <form action={approve}>
          <button className="bg-brand-600 text-white text-sm rounded-lg px-5 py-2.5">
            Approve & Sesuaikan Stok Otomatis
          </button>
        </form>
      )}
      {session?.status === "approved" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          Sudah disetujui — stok sistem sudah otomatis disesuaikan sesuai selisih di atas.
        </p>
      )}
    </div>
  );
}
