import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { warehouse?: string; q?: string };
}) {
  const supabase = createClient();

  const { data: warehouses } = await supabase.from("warehouses").select("id,name").eq("is_active", true);

  let query = supabase.from("v_inventory_summary").select("*").order("sku");

  if (searchParams.warehouse) {
    query = query.eq("warehouse_id", searchParams.warehouse);
  }
  if (searchParams.q) {
    query = query.or(`sku.ilike.%${searchParams.q}%,name.ilike.%${searchParams.q}%`);
  }

  const { data: rows } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory Barang</h1>
        <p className="text-slate-500 text-sm mt-1">
          Lihat stok per gudang. Gunakan filter untuk fokus ke satu gudang atau cari SKU/nama barang.
        </p>
      </div>

      <form className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Gudang</label>
          <select
            name="warehouse"
            defaultValue={searchParams.warehouse ?? ""}
            className="rounded-lg border border-slate-300 text-sm px-3 py-2"
          >
            <option value="">Semua Gudang</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Cari SKU / Nama</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            className="rounded-lg border border-slate-300 text-sm px-3 py-2 w-64"
            placeholder="contoh: SP31 atau Hand Bag"
          />
        </div>
        <button className="bg-brand-600 text-white text-sm rounded-lg px-4 py-2">Filter</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Gudang</th>
              <th className="px-4 py-3 text-right">Stok (PCS)</th>
              <th className="px-4 py-3 text-right">Stok (PKG)</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium">{r.sku}</td>
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.category_name}</td>
                <td className="px-4 py-2.5">{r.warehouse_name}</td>
                <td className="px-4 py-2.5 text-right">{Number(r.qty_pcs).toLocaleString("id-ID")}</td>
                <td className="px-4 py-2.5 text-right">{Number(r.qty_pkg).toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!rows || rows.length === 0) && (
          <p className="text-center text-sm text-slate-400 py-8">Tidak ada data.</p>
        )}
      </div>
    </div>
  );
}
