# Sistem Inventory Web — Next.js + Supabase

Aplikasi ini menggantikan spreadsheet manual (Input Harian, Inventory Tangerang/Jakarta,
Transfer Antar Gudang, History, Master Barang) menjadi sistem web multi-gudang
dengan role-based access, audit log permanen, dan stok yang selalu real-time.

## 1. Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka **SQL Editor**, jalankan seluruh isi `supabase/schema.sql`
3. Isi data master awal (lewat Table Editor atau SQL) sesuai data lama lu:
   - `warehouses`: Tangerang, Jakarta
   - `categories`: dari sheet Master Kategori
   - `suppliers`: dari sheet Master Supplier
   - `marketplaces`: Shopee, Tokopedia, TikTok Shop, dll (sesuai marketplace yang dipakai)
   - `items`: dari sheet Master Barang (SKU, nama, kategori, pcs/pkg, supplier default)
4. Buat user pertama:
   - Supabase Dashboard → Authentication → Add User (isi email + password)
   - Lalu di SQL Editor: `update profiles set role = 'super_admin' where id = '<user-id>';`
5. Untuk stok awal (opening balance), gunakan menu **Input Barang Masuk/Keluar**
   di aplikasi (pilih "Barang Masuk") untuk tiap SKU per gudang — supaya tercatat
   otomatis di audit log dan stok sistem langsung akurat. Jangan insert manual ke
   `warehouse_stock` lewat SQL, karena tabel itu hanya boleh diubah lewat trigger transaksi.

## 2. Setup Aplikasi

```bash
npm install
cp .env.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# (Project Settings -> API di dashboard Supabase)
npm run dev
```

Buka http://localhost:3000 — otomatis redirect ke halaman login.

## 3. Role & Hak Akses

| Role | Bisa Akses |
|---|---|
| **Super Admin** | Semua fitur, termasuk ubah role user lain |
| **Admin** | Kelola user, approve stock opname, lihat semua gudang, audit log |
| **Staff Gudang** | Input barang masuk/keluar & transfer, tapi hanya untuk gudang yang di-assign |
| **Staff Marketplace** | Input penjualan marketplace untuk gudang yang di-assign |
| **Owner (Viewer)** | Lihat dashboard, inventory semua gudang, dan audit log — tanpa bisa input apapun |

Pembatasan ini dijalankan dua lapis: di UI (menu disembunyikan) dan di database
lewat **Row Level Security (RLS)** — jadi walau seseorang coba akses API langsung,
tetap tidak akan tembus di luar hak aksesnya.

## 4. Kenapa Data Tetap Konsisten (Tidak Bisa "Diakalin")

- **Stok tidak pernah diedit manual.** Angka di `warehouse_stock` murni hasil
  hitungan trigger dari tabel `transactions`. Tidak ada tombol atau API untuk
  mengubahnya langsung.
- **Transaksi tidak bisa diedit/dihapus.** Kalau salah input, buat transaksi
  koreksi baru (atau lewat stock opname untuk penyesuaian resmi).
- **Audit log benar-benar permanen** — bahkan admin dan super admin tidak bisa
  update/delete row di `audit_log`, karena diblokir di level database (trigger),
  bukan cuma di level aplikasi.
- **Stock opname punya alur approval**: staff input stok fisik → status
  "menunggu approval" → admin approve → sistem otomatis membuat transaksi
  penyesuaian sesuai selisih. Semua tercatat, tidak ada yang hilang.

## 5. Struktur Halaman

- `/login` — login
- `/dashboard` — ringkasan stok semua gudang, alert barang menipis
- `/inventory` — lihat stok per gudang, filter & pencarian SKU
- `/transaksi` — input barang masuk / keluar
- `/transfer` — transfer stok antar gudang
- `/sales-input` — input penjualan marketplace (auto kurangi stok)
- `/stock-opname` — daftar sesi opname, buat baru, approve
- `/audit-log` — riwayat semua aktivitas (read-only)
- `/admin/users` — registrasi user & atur role (khusus admin)

## 6. Deploy

Rekomendasi paling gampang: **Vercel** (gratis untuk mulai).
1. Push folder ini ke GitHub repo
2. Import ke Vercel, isi environment variables yang sama seperti `.env.local`
3. Deploy — otomatis dapat URL `https://nama-app.vercel.app`

## 7. Langkah Lanjutan yang Disarankan

Aplikasi ini adalah fondasi yang solid dan sudah bisa dipakai produksi untuk
fitur-fitur inti di atas. Beberapa penyempurnaan lanjutan yang bisa ditambahkan
bertahap sesuai kebutuhan riil (tidak wajib di awal):
- Export laporan ke Excel/PDF per periode
- Notifikasi (email/WhatsApp) saat stok di bawah threshold
- Import massal Master Barang dari file Excel
- Multi-bahasa (ID/EN/CN) mengikuti gaya sheet lama yang bilingual
- Riwayat harga beli & kalkulasi nilai inventory (HPP)
