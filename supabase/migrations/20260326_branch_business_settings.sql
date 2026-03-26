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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_branch_business_settings_updated_at on public.branch_business_settings;
create trigger trg_branch_business_settings_updated_at
before update on public.branch_business_settings
for each row
execute procedure public.set_updated_at();
