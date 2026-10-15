-- UBGForever chat history. Run once: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- (Separate from supabase-setup.sql, which creates the apps tables.)
--
-- Privacy model: the table itself is locked (row level security on, NO policies), so the public
-- key cannot read or write it directly. The site talks to it only through the two functions below,
-- and history can only be loaded by someone who knows the room code. Treat room codes like
-- passwords: anyone who has one can read that room's saved history.

create table if not exists public.chat_messages (
  id          uuid primary key,
  room_code   text        not null check (room_code ~ '^[A-Z0-9]{4,8}$'),
  user_id     text        not null check (char_length(user_id) between 1 and 64),
  name        text        not null check (char_length(name) between 1 and 24),
  body        text        not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_room_time_idx
  on public.chat_messages (room_code, created_at desc);

alter table public.chat_messages enable row level security;   -- no policies on purpose

-- Save one message (idempotent: re-sending the same id is ignored). Light flood protection included.
create or replace function public.post_chat_message(
  p_id uuid, p_room text, p_user text, p_name text, p_body text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.chat_messages
        where user_id = p_user and created_at > now() - interval '10 seconds') >= 12 then
    raise exception 'rate limit' using errcode = 'P0001';
  end if;

  insert into public.chat_messages (id, room_code, user_id, name, body)
  values (p_id, upper(p_room), left(p_user, 64), left(p_name, 24), left(p_body, 500))
  on conflict (id) do nothing;
end $$;

-- Load a room's recent history (oldest first, max 300).
create or replace function public.get_chat_messages(p_room text, p_limit int default 300)
returns table (id uuid, user_id text, name text, body text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select t.id, t.user_id, t.name, t.body, t.created_at
  from (
    select m.id, m.user_id, m.name, m.body, m.created_at
    from public.chat_messages m
    where m.room_code = upper(p_room)
    order by m.created_at desc
    limit least(greatest(p_limit, 1), 300)
  ) t
  order by t.created_at asc
$$;

revoke all on function public.post_chat_message(uuid, text, text, text, text) from public;
revoke all on function public.get_chat_messages(text, int) from public;
grant execute on function public.post_chat_message(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.get_chat_messages(text, int) to anon, authenticated;

-- Optional housekeeping: delete messages older than 30 days (run manually or schedule it).
-- delete from public.chat_messages where created_at < now() - interval '30 days';
