-- Run manually in the partner project's Supabase SQL Editor.
-- Existing player names/XP are in browser localStorage, not a Supabase table.
-- This adds an opt-in shared leaderboard; Join leaderboard publishes that device's
-- profile name, XP and profile-picture URL. It does not expose chat/auth records.
-- Scores are device-reported, not a verified competitive/anti-cheat system.
begin;

create table if not exists public.slipstream_players (
  player_id uuid primary key,
  device_secret uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  xp bigint not null check (xp between 0 and 1000000000),
  avatar_url text check (
    avatar_url is null or
    (char_length(avatar_url) <= 2000 and avatar_url ~ '^https://')
  ),
  updated_at timestamptz not null default now()
);

create index if not exists slipstream_players_ranking_idx
  on public.slipstream_players (xp desc, name asc, player_id asc);

alter table public.slipstream_players enable row level security;
revoke all on public.slipstream_players from anon, authenticated;

create or replace function public.publish_slipstream_profile(
  p_player_id uuid,
  p_secret uuid,
  p_name text,
  p_xp bigint,
  p_avatar_url text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null or p_secret is null then
    raise exception 'Missing device identity';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception 'Name must contain 1 to 40 characters';
  end if;
  if p_xp is null or p_xp < 0 or p_xp > 1000000000 then
    raise exception 'Invalid XP';
  end if;
  if p_avatar_url is not null and (
    char_length(p_avatar_url) > 2000 or p_avatar_url !~ '^https://'
  ) then
    raise exception 'Profile picture must use HTTPS';
  end if;

  insert into public.slipstream_players(player_id, device_secret, name, xp, avatar_url)
  values (p_player_id, p_secret, btrim(p_name), p_xp, p_avatar_url)
  on conflict (player_id) do update
    set name = excluded.name,
        xp = excluded.xp,
        avatar_url = excluded.avatar_url,
        updated_at = now()
    where slipstream_players.device_secret = p_secret;

  if not found then
    raise exception 'Device identity does not match';
  end if;
end;
$$;

create or replace function public.get_slipstream_leaderboard()
returns table (rank_number bigint, name text, xp bigint, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select row_number() over (order by p.xp desc, p.name asc, p.player_id asc),
         p.name, p.xp, p.avatar_url
  from public.slipstream_players p
  order by p.xp desc, p.name asc, p.player_id asc
  limit 10;
$$;

create or replace function public.leave_slipstream_leaderboard(
  p_player_id uuid,
  p_secret uuid
) returns void
language sql
security definer
set search_path = public
as $$
  delete from public.slipstream_players
  where player_id = p_player_id and device_secret = p_secret;
$$;

revoke all on function public.publish_slipstream_profile(uuid, uuid, text, bigint, text) from public;
revoke all on function public.get_slipstream_leaderboard() from public;
revoke all on function public.leave_slipstream_leaderboard(uuid, uuid) from public;
grant execute on function public.publish_slipstream_profile(uuid, uuid, text, bigint, text) to anon, authenticated;
grant execute on function public.get_slipstream_leaderboard() to anon, authenticated;
grant execute on function public.leave_slipstream_leaderboard(uuid, uuid) to anon, authenticated;

commit;

-- Inspect the same public fields the frontend reads:
select * from public.get_slipstream_leaderboard();
