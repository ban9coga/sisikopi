create table if not exists public.branches (
  id text primary key,
  name text not null,
  address text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.branch_business_settings (
  branch_id text primary key references public.branches(id) on delete cascade,
  store_name text not null,
  receipt_footer text not null default 'Terima kasih sudah mampir ke Sisikopi.',
  whatsapp text not null default '',
  operating_hours text not null default '',
  enabled_payment_methods jsonb not null default '["cash","qris"]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'kasir')),
  branch_id text not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  base_price integer not null default 0 check (base_price >= 0),
  emoji text not null default '☕',
  is_available boolean not null default true,
  branch_id text null references public.branches(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_option_groups (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  group_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, group_key)
);

create table if not exists public.product_option_choices (
  id text primary key,
  option_group_id text not null references public.product_option_groups(id) on delete cascade,
  name text not null,
  extra_price integer not null default 0 check (extra_price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id text primary key,
  order_number text not null,
  branch_id text not null references public.branches(id) on delete restrict,
  cashier_id text null references public.app_users(id) on delete set null,
  cashier_name text not null,
  payment_method text not null check (payment_method in ('cash', 'qris')),
  total_amount integer not null default 0 check (total_amount >= 0),
  status text not null check (status in ('pending', 'processing', 'done')),
  financial_status text not null default 'active' check (financial_status in ('active', 'void', 'refunded')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  voided_at timestamptz null,
  refunded_at timestamptz null,
  void_reason text null,
  refund_reason text null
);

create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text null references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  subtotal integer not null default 0 check (subtotal >= 0),
  selected_options_json jsonb not null default '[]'::jsonb,
  selected_options_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_products_branch on public.products(branch_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_branch_created_at on public.orders(branch_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_financial_status on public.orders(financial_status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_option_groups_product on public.product_option_groups(product_id, sort_order);
create index if not exists idx_option_choices_group on public.product_option_choices(option_group_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_branch_business_settings_updated_at on public.branch_business_settings;
create trigger trg_branch_business_settings_updated_at
before update on public.branch_business_settings
for each row
execute procedure public.set_updated_at();

comment on table public.app_users is 'Akun internal POS. Untuk tahap awal auth dikelola via route handler server.';
comment on table public.branch_business_settings is 'Settings bisnis per cabang untuk struk, metode pembayaran, dan identitas toko.';
comment on table public.products is 'branch_id null berarti menu global untuk semua cabang.';
comment on table public.order_items is 'Snapshot item saat transaksi dibuat, agar histori tidak berubah ketika produk diedit.';

-- Catatan:
-- 1. Jalankan file ini sekali di SQL Editor Supabase.
-- 2. Setelah itu isi env project (.env.local / Vercel env).
-- 3. Saat app boot dalam mode Supabase, demo branches/users/products akan otomatis di-seed dari default app.
