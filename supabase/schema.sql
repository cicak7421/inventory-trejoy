-- =========================================================================
-- INVENTORY SYSTEM — SUPABASE SCHEMA
-- Ganti dari spreadsheet manual ke sistem web multi-gudang
-- =========================================================================
-- Cara pakai: buka Supabase Dashboard -> SQL Editor -> paste seluruh file ini -> Run
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -------------------------------------------------------------------------
create type user_role as enum ('super_admin', 'admin', 'staff_gudang', 'staff_marketplace', 'owner_viewer');
create type transaction_type as enum ('masuk', 'keluar', 'transfer', 'penjualan_marketplace', 'stock_opname_adjustment');
create type opname_status as enum ('draft', 'submitted', 'approved', 'rejected');

-- -------------------------------------------------------------------------
-- 2. MASTER DATA
-- -------------------------------------------------------------------------

create table warehouses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,               -- Tangerang, Jakarta, dst
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  notes text
);

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  notes text
);

create table marketplaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,               -- Shopee, Tokopedia, TikTok Shop, dll
  notes text
);

create table items (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  name text not null,
  category_id uuid references categories(id),
  pcs_per_pkg numeric not null default 1,
  default_supplier_id uuid references suppliers(id),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_items_sku on items(sku);

-- -------------------------------------------------------------------------
-- 3. USERS & ROLES
-- Supabase Auth sudah handle tabel auth.users (email/password).
-- Tabel `profiles` adalah data tambahan: role & gudang yang di-assign.
-- -------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'staff_gudang',
  -- staff_gudang hanya bisa akses gudang yang di-assign (null = admin/owner = semua gudang)
  assigned_warehouse_id uuid references warehouses(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper function: ambil role user yang sedang login
create or replace function auth_user_role() returns user_role
language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_user_warehouse() returns uuid
language sql stable security definer as $$
  select assigned_warehouse_id from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select coalesce(auth_user_role() in ('super_admin','admin'), false);
$$;

-- Auto-create profile row saat user baru registrasi lewat Supabase Auth
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff_gudang');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -------------------------------------------------------------------------
-- 4. STOK GUDANG (current stock per item per warehouse)
-- Ini "database stok utama" — nilai diupdate otomatis oleh trigger transaksi,
-- BUKAN diedit manual oleh user.
-- -------------------------------------------------------------------------

create table warehouse_stock (
  id uuid primary key default uuid_generate_v4(),
  warehouse_id uuid not null references warehouses(id),
  item_id uuid not null references items(id),
  qty_pcs numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (warehouse_id, item_id)
);

create index idx_wstock_wh on warehouse_stock(warehouse_id);
create index idx_wstock_item on warehouse_stock(item_id);

-- Stok awal (opening balance), dicatat sebagai batch, dipakai untuk audit/history saja
create table stock_opening (
  id uuid primary key default uuid_generate_v4(),
  batch_no text,
  warehouse_id uuid not null references warehouses(id),
  item_id uuid not null references items(id),
  qty_pcs numeric not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 5. TRANSAKSI — 1 tabel utama untuk semua pergerakan (mirip "Input Harian")
-- -------------------------------------------------------------------------

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  trx_date date not null default current_date,
  trx_type transaction_type not null,
  item_id uuid not null references items(id),
  qty_pcs numeric not null check (qty_pcs > 0),

  -- untuk masuk
  supplier_id uuid references suppliers(id),

  -- untuk keluar / penjualan_marketplace
  marketplace_id uuid references marketplaces(id),
  order_no text,

  -- gudang asal & tujuan (transfer pakai keduanya, masuk/keluar pakai salah satu)
  warehouse_from_id uuid references warehouses(id),
  warehouse_to_id uuid references warehouses(id),

  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),

  constraint chk_warehouse_logic check (
    (trx_type = 'masuk' and warehouse_to_id is not null and warehouse_from_id is null) or
    (trx_type in ('keluar','penjualan_marketplace') and warehouse_from_id is not null and warehouse_to_id is null) or
    (trx_type = 'transfer' and warehouse_from_id is not null and warehouse_to_id is not null and warehouse_from_id <> warehouse_to_id) or
    (trx_type = 'stock_opname_adjustment')
  )
);
create index idx_trx_date on transactions(trx_date);
create index idx_trx_item on transactions(item_id);

-- Fungsi untuk apply efek transaksi ke warehouse_stock
create or replace function apply_transaction_to_stock() returns trigger
language plpgsql security definer as $$
begin
  if new.trx_type = 'masuk' then
    insert into warehouse_stock (warehouse_id, item_id, qty_pcs)
    values (new.warehouse_to_id, new.item_id, new.qty_pcs)
    on conflict (warehouse_id, item_id)
    do update set qty_pcs = warehouse_stock.qty_pcs + new.qty_pcs, updated_at = now();

  elsif new.trx_type in ('keluar','penjualan_marketplace') then
    insert into warehouse_stock (warehouse_id, item_id, qty_pcs)
    values (new.warehouse_from_id, new.item_id, -new.qty_pcs)
    on conflict (warehouse_id, item_id)
    do update set qty_pcs = warehouse_stock.qty_pcs - new.qty_pcs, updated_at = now();

  elsif new.trx_type = 'transfer' then
    insert into warehouse_stock (warehouse_id, item_id, qty_pcs)
    values (new.warehouse_from_id, new.item_id, -new.qty_pcs)
    on conflict (warehouse_id, item_id)
    do update set qty_pcs = warehouse_stock.qty_pcs - new.qty_pcs, updated_at = now();

    insert into warehouse_stock (warehouse_id, item_id, qty_pcs)
    values (new.warehouse_to_id, new.item_id, new.qty_pcs)
    on conflict (warehouse_id, item_id)
    do update set qty_pcs = warehouse_stock.qty_pcs + new.qty_pcs, updated_at = now();
  end if;

  return new;
end;
$$;

create trigger trg_apply_transaction
  after insert on transactions
  for each row execute function apply_transaction_to_stock();

-- Transaksi TIDAK BOLEH diubah atau dihapus (audit trail). Hanya insert.
create or replace function block_transaction_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Transaksi tidak dapat diubah atau dihapus. Jika salah input, buat transaksi koreksi baru.';
end;
$$;
create trigger trg_block_trx_update before update on transactions for each row execute function block_transaction_mutation();
create trigger trg_block_trx_delete before delete on transactions for each row execute function block_transaction_mutation();

-- -------------------------------------------------------------------------
-- 6. STOCK OPNAME
-- Staff input stok fisik aktual -> sistem hitung selisih vs stok sistem.
-- Setelah di-approve admin, selisih otomatis jadi transaksi penyesuaian.
-- -------------------------------------------------------------------------

create table stock_opname_sessions (
  id uuid primary key default uuid_generate_v4(),
  warehouse_id uuid not null references warehouses(id),
  opname_date date not null default current_date,
  status opname_status not null default 'draft',
  created_by uuid not null references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table stock_opname_lines (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references stock_opname_sessions(id) on delete cascade,
  item_id uuid not null references items(id),
  qty_system numeric not null,       -- snapshot stok sistem saat opname dibuat
  qty_actual numeric not null,       -- input fisik dari staff
  selisih numeric generated always as (qty_actual - qty_system) stored,
  notes text
);
create index idx_opname_session on stock_opname_lines(session_id);

-- Saat admin approve opname -> generate transaksi penyesuaian otomatis per line yang selisih != 0
create or replace function approve_stock_opname(p_session_id uuid) returns void
language plpgsql security definer as $$
declare
  r record;
  v_wh uuid;
begin
  if not is_admin() then
    raise exception 'Hanya admin yang dapat approve stock opname';
  end if;

  select warehouse_id into v_wh from stock_opname_sessions where id = p_session_id;

  for r in select * from stock_opname_lines where session_id = p_session_id and selisih <> 0 loop
    insert into transactions (
      trx_type, item_id, qty_pcs, warehouse_from_id, warehouse_to_id, notes, created_by
    ) values (
      'stock_opname_adjustment',
      r.item_id,
      abs(r.selisih),
      case when r.selisih < 0 then v_wh else null end,
      case when r.selisih > 0 then v_wh else null end,
      'Penyesuaian stock opname session ' || p_session_id,
      auth.uid()
    );
  end loop;

  update stock_opname_sessions
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_session_id;
end;
$$;

-- -------------------------------------------------------------------------
-- 7. AUDIT LOG — tidak bisa dihapus/diubah oleh SIAPAPUN (termasuk admin)
-- Diisi otomatis lewat trigger dari tabel-tabel penting.
-- -------------------------------------------------------------------------

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  action text not null,             -- contoh: 'CREATE_TRANSACTION', 'USER_ROLE_CHANGE', 'LOGIN'
  table_name text,
  record_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_created on audit_log(created_at);
create index idx_audit_actor on audit_log(actor_id);

-- Blokir keras: tidak ada yang boleh update/delete row audit_log, titik.
create or replace function block_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Audit log bersifat permanen dan tidak dapat diubah atau dihapus.';
end;
$$;
create trigger trg_block_audit_update before update on audit_log for each row execute function block_audit_mutation();
create trigger trg_block_audit_delete before delete on audit_log for each row execute function block_audit_mutation();

-- Generic trigger function: catat setiap insert transaksi ke audit_log
create or replace function log_transaction_to_audit() returns trigger
language plpgsql security definer as $$
begin
  insert into audit_log (actor_id, action, table_name, record_id, detail)
  values (new.created_by, 'CREATE_TRANSACTION', 'transactions', new.id, to_jsonb(new));
  return new;
end;
$$;
create trigger trg_audit_transaction after insert on transactions
  for each row execute function log_transaction_to_audit();

-- Catat perubahan role/user (aktivitas admin) ke audit log
create or replace function log_profile_change_to_audit() returns trigger
language plpgsql security definer as $$
begin
  insert into audit_log (actor_id, action, table_name, record_id, detail)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE_USER' else 'UPDATE_USER' end,
    'profiles', new.id,
    jsonb_build_object('old', case when tg_op = 'UPDATE' then to_jsonb(old) else null end, 'new', to_jsonb(new))
  );
  return new;
end;
$$;
create trigger trg_audit_profile after insert or update on profiles
  for each row execute function log_profile_change_to_audit();

-- Catat approval stock opname
create or replace function log_opname_approval_to_audit() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into audit_log (actor_id, action, table_name, record_id, detail)
    values (auth.uid(), 'APPROVE_STOCK_OPNAME', 'stock_opname_sessions', new.id, to_jsonb(new));
  end if;
  return new;
end;
$$;
create trigger trg_audit_opname after update on stock_opname_sessions
  for each row execute function log_opname_approval_to_audit();

-- -------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- -------------------------------------------------------------------------

alter table warehouses enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table marketplaces enable row level security;
alter table items enable row level security;
alter table profiles enable row level security;
alter table warehouse_stock enable row level security;
alter table stock_opening enable row level security;
alter table transactions enable row level security;
alter table stock_opname_sessions enable row level security;
alter table stock_opname_lines enable row level security;
alter table audit_log enable row level security;

-- Master data: semua user yang login boleh READ, hanya admin boleh WRITE
create policy master_read on warehouses for select using (auth.uid() is not null);
create policy master_write on warehouses for all using (is_admin()) with check (is_admin());

create policy cat_read on categories for select using (auth.uid() is not null);
create policy cat_write on categories for all using (is_admin()) with check (is_admin());

create policy sup_read on suppliers for select using (auth.uid() is not null);
create policy sup_write on suppliers for all using (is_admin()) with check (is_admin());

create policy mkt_read on marketplaces for select using (auth.uid() is not null);
create policy mkt_write on marketplaces for all using (is_admin()) with check (is_admin());

create policy items_read on items for select using (auth.uid() is not null);
create policy items_write on items for all using (is_admin()) with check (is_admin());

-- Profiles: user bisa lihat profil sendiri; admin bisa lihat & kelola semua
create policy profile_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profile_admin_write on profiles for insert with check (is_admin());
create policy profile_admin_update on profiles for update using (is_admin()) with check (is_admin());
-- Tidak ada policy DELETE untuk profiles -> tidak ada yang bisa hapus user (nonaktifkan saja via is_active)

-- Warehouse stock: admin/owner lihat semua; staff gudang hanya lihat gudangnya sendiri
create policy stock_read on warehouse_stock for select using (
  is_admin() or auth_user_role() = 'owner_viewer' or warehouse_id = auth_user_warehouse()
);
-- Tidak ada policy insert/update manual dari client — hanya trigger (security definer) yang boleh mengubah

-- Transactions: staff gudang hanya boleh insert untuk gudangnya sendiri; admin bebas; semua role boleh baca sesuai gudangnya
create policy trx_read on transactions for select using (
  is_admin() or auth_user_role() = 'owner_viewer'
  or warehouse_from_id = auth_user_warehouse() or warehouse_to_id = auth_user_warehouse()
);
create policy trx_insert on transactions for insert with check (
  created_by = auth.uid() and (
    is_admin()
    or (auth_user_role() = 'staff_marketplace' and trx_type = 'penjualan_marketplace' and warehouse_from_id = auth_user_warehouse())
    or (auth_user_role() = 'staff_gudang' and trx_type in ('masuk','keluar','transfer')
        and (warehouse_from_id = auth_user_warehouse() or warehouse_to_id = auth_user_warehouse()))
  )
);
-- Tidak ada policy update/delete -> ditutup total oleh trigger block_transaction_mutation() di atas juga

-- Stock opname: staff gudang bikin punya gudangnya, admin approve
create policy opname_read on stock_opname_sessions for select using (
  is_admin() or auth_user_role() = 'owner_viewer' or warehouse_id = auth_user_warehouse()
);
create policy opname_insert on stock_opname_sessions for insert with check (
  created_by = auth.uid() and (is_admin() or warehouse_id = auth_user_warehouse())
);
create policy opname_update on stock_opname_sessions for update using (
  is_admin() or (created_by = auth.uid() and status = 'draft')
);

create policy opname_lines_read on stock_opname_lines for select using (
  exists (select 1 from stock_opname_sessions s where s.id = session_id and (
    is_admin() or auth_user_role() = 'owner_viewer' or s.warehouse_id = auth_user_warehouse()
  ))
);
create policy opname_lines_write on stock_opname_lines for all using (
  exists (select 1 from stock_opname_sessions s where s.id = session_id and (
    is_admin() or (s.created_by = auth.uid() and s.status = 'draft')
  ))
);

-- Audit log: hanya admin/owner yang boleh baca; tidak ada yang boleh insert langsung dari client
-- (audit_log hanya diisi lewat trigger security definer di atas)
create policy audit_read on audit_log for select using (is_admin() or auth_user_role() = 'owner_viewer');

-- -------------------------------------------------------------------------
-- 9. VIEW BANTUAN UNTUK DASHBOARD
-- -------------------------------------------------------------------------

create view v_inventory_summary as
select
  i.sku, i.name, i.category_id, c.name as category_name,
  w.id as warehouse_id, w.name as warehouse_name,
  coalesce(ws.qty_pcs, 0) as qty_pcs,
  i.pcs_per_pkg,
  case when i.pcs_per_pkg > 0 then floor(coalesce(ws.qty_pcs,0) / i.pcs_per_pkg) else 0 end as qty_pkg
from items i
cross join warehouses w
left join warehouse_stock ws on ws.item_id = i.id and ws.warehouse_id = w.id
left join categories c on c.id = i.category_id
where i.is_active and w.is_active;

create view v_low_stock as
select * from v_inventory_summary where qty_pcs <= 300; -- threshold, bisa dibuat configurable

-- =========================================================================
-- SELESAI. Setelah run script ini:
-- 1. Insert data awal ke warehouses ('Tangerang','Jakarta'), categories, suppliers dari Master lama.
-- 2. Buat user pertama lewat Supabase Auth, lalu UPDATE profiles SET role='super_admin' utk user itu.
-- 3. Import Master Barang & stok awal via aplikasi (bukan lewat SQL manual) supaya tercatat di audit log.
-- =========================================================================
