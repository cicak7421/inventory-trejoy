import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: summary } = await supabase.from("v_inventory_summary").select("*");
  const { data: lowStock } = await supabase.from("v_low_stock").select("*").limit(10);

  const totalSku = new Set(summary?.map((r) => r.sku)).size;
  const totalPcs = summary?.reduce((sum, r) => sum + Number(r.qty_pcs), 0) ?? 0;

  const byWarehouse: Record<string, number> = {};
  summary?.forEach((r) => {
    byWarehouse[r.warehouse_name] = (byWarehouse[r.warehouse_name] ?? 0) + Number(r.qty_pcs);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Ringkasan stok seluruh gudang secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Total SKU Aktif" value={totalSku.toLocaleString("id-ID")} />
        <Card label="Total Stok (PCS)" value={totalPcs.toLocaleString("id-ID")} />
        <Card label="SKU Hampir Habis" value={(lowStock?.length ?? 0).toLocaleString("id-ID")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-medium mb-3">Stok per Gudang</h2>
          <div className="space-y-2">
            {Object.entries(byWarehouse).map(([wh, qty]) => (
              <div key={wh} className="flex justify-between text-sm">
                <span className="text-slate-600">{wh}</span>
                <span className="font-medium">{qty.toLocaleString("id-ID")} pcs</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-medium mb-3">Barang Hampir Habis (≤ 300 pcs)</h2>
          <div className="space-y-2 max-h-64 overflow-auto">
            {lowStock?.map((r, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-slate-50 pb-1">
                <span className="text-slate-600">{r.sku} · {r.name} ({r.warehouse_name})</span>
                <span className="font-medium text-amber-600">{r.qty_pcs} pcs</span>
              </div>
            ))}
            {(!lowStock || lowStock.length === 0) && (
              <p className="text-sm text-slate-400">Tidak ada barang menipis saat ini.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
