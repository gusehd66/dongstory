create table if not exists public.map_layouts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'active',
  is_active boolean not null default false,
  version bigint not null,
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists map_layouts_one_active
  on public.map_layouts (is_active)
  where is_active = true;

create or replace function public.set_map_layouts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_map_layouts_updated_at on public.map_layouts;

create trigger set_map_layouts_updated_at
before update on public.map_layouts
for each row
execute function public.set_map_layouts_updated_at();

alter table public.map_layouts enable row level security;

create policy "Public can read active map layouts"
on public.map_layouts
for select
using (is_active = true);

-- For production, create a stricter write policy tied to authenticated admins.
-- During local development, use the Supabase dashboard or a temporary admin-only policy for editor saves.
