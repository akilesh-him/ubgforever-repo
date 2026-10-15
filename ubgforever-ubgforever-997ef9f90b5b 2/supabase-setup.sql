-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Creates the two tables UBGForever reads, with public read-only access.

create table if not exists public.apps (
  id            bigint generated always as identity primary key,
  name          text not null,
  description   text,
  img           text,            -- icon / thumbnail URL
  category      text,            -- 'AI' | 'Game' | 'Files & Productivity' | 'Social'
  developer     text,
  submitted_by  text,
  file_size     text,
  downloads     bigint default 0,
  likes         bigint default 0,
  app_url       text,            -- URL loaded when the app is launched
  html_code     text,            -- optional: inline HTML to run instead of app_url
  download_url  text,
  created_at    timestamptz default now()
);

create table if not exists public.app_versions (
  id            bigint generated always as identity primary key,
  app_id        bigint references public.apps(id) on delete cascade,
  version_name  text,
  changelog     text,
  release_date  timestamptz default now()
);

alter table public.apps          enable row level security;
alter table public.app_versions  enable row level security;

drop policy if exists "public read apps" on public.apps;
create policy "public read apps" on public.apps
  for select to anon, authenticated using (true);

drop policy if exists "public read versions" on public.app_versions;
create policy "public read versions" on public.app_versions
  for select to anon, authenticated using (true);

-- Example row so you can confirm the hub loads:
insert into public.apps (name, description, category, developer, app_url)
values ('Example App', 'Delete me once your real apps are added.', 'Game', 'You', 'https://example.com');
