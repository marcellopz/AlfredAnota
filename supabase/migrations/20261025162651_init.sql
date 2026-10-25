-- Fase 0: tabelas base. Menor privilégio: o padrão do Supabase concede acesso
-- às tabelas novas para anon/authenticated, então revogamos tudo e liberamos
-- só o que o site usa hoje.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  daily_msg_limit int not null default 100,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('telegram')),
  external_id text not null,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  unique (type, external_id)
);

create unique index channels_one_active_per_user
  on public.channels (user_id, type) where status = 'active';

create table public.link_tokens (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{32}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.message_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  channel_type text not null default 'telegram',
  external_chat_id text not null,
  external_message_id bigint,
  text text,
  intent text,
  model text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  error text,
  created_at timestamptz not null default now(),
  unique (channel_type, external_chat_id, external_message_id)
);

create index message_log_user_created_idx on public.message_log (user_id, created_at);

-- RLS: sem policy significa negado.
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.link_tokens enable row level security;
alter table public.message_log enable row level security;

revoke all on public.profiles, public.channels, public.link_tokens, public.message_log
  from anon, authenticated;

-- O site lê os próprios dados.
grant select on public.profiles, public.channels, public.message_log to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy channels_select_own on public.channels
  for select to authenticated using (user_id = (select auth.uid()));

create policy message_log_select_own on public.message_log
  for select to authenticated using (user_id = (select auth.uid()));

-- O usuário só edita nome, fuso e idioma; nunca daily_msg_limit.
grant update (display_name, timezone, locale) on public.profiles to authenticated;

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- link_tokens: nenhuma policy nem grant; o acesso virá por função na Fase 1.

-- O bot usa service_role.
grant all on public.profiles, public.channels, public.link_tokens, public.message_log
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Cria o profile quando um usuário é criado em auth.users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
