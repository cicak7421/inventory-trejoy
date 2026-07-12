import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import NewOpnameForm from "./NewOpnameForm";

export default async function NewStockOpnamePage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();
  const { data: warehouses } = await supabase.from("warehouses").select("id, name").eq("is_active", true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buat Stock Opname Baru</h1>
        <p className="text-slate-500 text-sm mt-1">
          Pilih gudang, lalu masukkan stok aktual hasil hitung fisik untuk setiap barang. Selisih plus/minus tampil otomatis.
        </p>
      </div>
      <NewOpnameForm warehouses={warehouses ?? []} defaultWarehouseId={profile?.assigned_warehouse_id ?? undefined} />
    </div>
  );
}
