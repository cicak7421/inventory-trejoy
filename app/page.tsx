import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function StockOpnamePage() {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from("stock_opname_sessions")
    .select("id, opname_date, status, warehouses(name), profiles:created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Opname</h1>
          <p className="text-slate-500 text-sm mt-1">
            Bandingkan stok fisik dengan stok sistem. Selisih akan tampil otomatis setelah input.
          </p>
        </div>
        <Link href="/stock-opname/new" className="bg-brand-600 text-white text-sm rounded-lg px-4 py-2.5">
          + Buat Opname Baru
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Gudang</th>
              <th className="px-4 py-3">Dibuat oleh</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions?.map((s: any) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">{s.opname_date}</td>
                <td className="px-4 py-2.5">{s.warehouses?.name}</td>
                <td className="px-4 py-2.5">{s.profiles?.full_name}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/stock-opname/${s.id}`} className="text-brand-600 text-sm font-medium">
                    Lihat Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!sessions || sessions.length === 0) && (
          <p className="text-center text-sm text-slate-400 py-8">Belum ada sesi stock opname.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    submitted: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };
  const labelMap: Record<string, string> = {
    draft: "Draft",
    submitted: "Menunggu Approval",
    approved: "Disetujui",
    rejected: "Ditolak",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>{labelMap[status]}</span>;
}
