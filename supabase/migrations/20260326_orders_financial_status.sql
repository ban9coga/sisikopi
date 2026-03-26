alter table public.orders
add column if not exists financial_status text not null default 'active'
check (financial_status in ('active', 'void', 'refunded'));

alter table public.orders
add column if not exists voided_at timestamptz null;

alter table public.orders
add column if not exists refunded_at timestamptz null;

alter table public.orders
add column if not exists void_reason text null;

alter table public.orders
add column if not exists refund_reason text null;

create index if not exists idx_orders_financial_status
on public.orders(financial_status);
