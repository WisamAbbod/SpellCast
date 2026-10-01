-- Spacewrite — Supabase schema
--
-- Run this once, whole, in the SQL editor of a fresh project. It is written to
-- be re-runnable: everything is `if not exists` or `create or replace`, so
-- pasting it again after an edit is safe.
--
-- Before running, enable Anonymous sign-ins:
--   Authentication -> Sign In / Providers -> Anonymous
-- It is OFF by default and every write fails silently without it.
--
-- Two independent features live here:
--   1. the global daily leaderboard  (table: scores)
--   2. online slow mode              (tables: slow_rooms, slow_moves, slow_results)
--
-- Online slow mode syncs MOVES, not game state. Every device rebuilds the board
-- by replaying the log through the same pure reducers, which is possible because
-- src/game/slow/ has no Math.random() and no Date.now() in it. That is why
-- slow_moves rows are tiny and why this schema stores no boards.

-- ---------------------------------------------------------------------------
-- 1. Daily leaderboard
-- ---------------------------------------------------------------------------

create table if not exists public.scores (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null default auth.uid(),
  date              date not null,
  puzzle            int  not null,
  generator_version text not null,
  score             int  not null check (score >= 0 and score <= 100000),
  word_count        int  not null default 0,
  best_word         text,
  best_word_score   int  default 0,
  par_percent       int  default 0,
  display_name      text,
  created_at        timestamptz not null default now(),
  unique (player_id, date, generator_version)
);

alter table public.scores enable row level security;

drop policy if exists "scores are public" on public.scores;
create policy "scores are public"
  on public.scores for select using (true);

drop policy if exists "insert own score" on public.scores;
create policy "insert own score"
  on public.scores for insert to authenticated
  with check ((select auth.uid()) = player_id);

drop policy if exists "update own score" on public.scores;
create policy "update own score"
  on public.scores for update to authenticated
  using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);

create index if not exists scores_daily_idx
  on public.scores (date, generator_version, score desc);

-- ---------------------------------------------------------------------------
-- 2. Online slow mode
-- ---------------------------------------------------------------------------

-- A room. `roster` is the ordered seating: turn N belongs to roster[N % count].
-- Order is fixed when the game starts and never changes, which is what lets
-- every client work out whose turn it is without asking anyone.
create table if not exists public.slow_rooms (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  host_id           uuid not null default auth.uid(),
  seed              text not null,
  rounds            int  not null default 5 check (rounds between 1 and 10),
  timer_enabled     boolean not null default true,
  is_public         boolean not null default false,
  status            text not null default 'lobby'
                      check (status in ('lobby', 'playing', 'finished', 'abandoned')),
  roster            jsonb not null default '[]'::jsonb,
  generator_version text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz
);

-- One row per move. seq is dense and starts at 0.
--
-- `unique (room_id, seq)` is the entire conflict-resolution strategy: two
-- clients racing to claim the same turn compute the same seq, exactly one
-- insert survives, and the loser re-reads and sees the turn was taken.
create table if not exists public.slow_moves (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.slow_rooms(id) on delete cascade,
  seq        int  not null check (seq >= 0),
  player_id  uuid not null default auth.uid(),
  type       text not null check (type in ('word', 'pass', 'shuffle', 'swap', 'hint', 'extend')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, seq)
);

create index if not exists slow_moves_room_idx on public.slow_moves (room_id, seq);

-- Final standings, written once when the game ends. Kept separate from the
-- move log so the results screen is one cheap read rather than a replay.
create table if not exists public.slow_results (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.slow_rooms(id) on delete cascade,
  player_id       uuid,
  display_name    text not null,
  is_bot          boolean not null default false,
  rank            int  not null,
  total           int  not null,
  score           int  not null default 0,
  gems            int  not null default 0,
  word_count      int  not null default 0,
  best_word       text,
  best_word_score int  not null default 0,
  created_at      timestamptz not null default now(),
  unique (room_id, display_name, rank)
);

create index if not exists slow_results_room_idx on public.slow_results (room_id);
create index if not exists slow_results_board_idx on public.slow_results (total desc, created_at);

-- --- helpers ---------------------------------------------------------------

-- Is the caller seated in this room? Used by every policy below.
--
-- SECURITY DEFINER so a policy on slow_moves can read slow_rooms without the
-- caller needing their own select right on it, and without the two policies
-- becoming mutually recursive.
create or replace function public.in_slow_roster(p_room uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.slow_rooms r,
         jsonb_array_elements(r.roster) seat
    where r.id = p_room
      and (seat->>'uid')::uuid = auth.uid()
  );
$$;

-- A short, unambiguous code. No O/0 or I/1, so it survives being read aloud.
create or replace function public.new_room_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt   int := 0;
begin
  loop
    candidate := '';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.slow_rooms where code = candidate);

    attempt := attempt + 1;
    if attempt > 50 then
      -- Vanishingly unlikely at 32^5, but never loop forever.
      raise exception 'could not allocate a room code';
    end if;
  end loop;

  return candidate;
end;
$$;

-- --- row level security ----------------------------------------------------

alter table public.slow_rooms   enable row level security;
alter table public.slow_moves   enable row level security;
alter table public.slow_results enable row level security;

-- Readable if you are in it, or if it is a public room still taking players
-- (that is how the join-by-browse path finds anything).
drop policy if exists "read rooms you can see" on public.slow_rooms;
create policy "read rooms you can see"
  on public.slow_rooms for select to authenticated
  using (
    host_id = (select auth.uid())
    or public.in_slow_roster(id)
    or (is_public and status = 'lobby')
  );

-- Rooms are only ever created and mutated through the functions below, which
-- run as definer. No direct insert or update policy exists on purpose: it keeps
-- the roster and the status transitions in one place.

drop policy if exists "read moves in your room" on public.slow_moves;
create policy "read moves in your room"
  on public.slow_moves for select to authenticated
  using (public.in_slow_roster(room_id));

-- Write your own moves, in a room you are seated in, that is actually running.
--
-- Note what this does NOT check: that it is your turn. Postgres cannot work
-- that out without replaying the JS engine, so turn order is enforced by the
-- clients and by the unique(room_id, seq) constraint. That is the same
-- "friendly, not cheat-proof" line the daily leaderboard already draws. What it
-- does prevent is a stranger writing into a game they are not part of.
drop policy if exists "write your own moves" on public.slow_moves;
create policy "write your own moves"
  on public.slow_moves for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and public.in_slow_roster(room_id)
    and exists (select 1 from public.slow_rooms r where r.id = room_id and r.status = 'playing')
  );

drop policy if exists "results are public" on public.slow_results;
create policy "results are public"
  on public.slow_results for select using (true);

drop policy if exists "write results for your room" on public.slow_results;
create policy "write results for your room"
  on public.slow_results for insert to authenticated
  with check (public.in_slow_roster(room_id));

-- --- room lifecycle --------------------------------------------------------

-- Housekeeping, run whenever somebody hosts or looks for a game - so it needs no
-- scheduled job, which the free plan does not have. A game nobody has touched
-- for six hours, or a lobby nobody started for two, is somebody who closed the
-- app; it is marked abandoned. Abandoned rooms go after a week (their moves go
-- with them). Finished games are kept: their results are the record.
create or replace function public.tidy_slow_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  update public.slow_rooms
  set status = 'abandoned', updated_at = now()
  where (status = 'playing' and coalesce(started_at, created_at) < now() - interval '6 hours')
     or (status = 'lobby' and created_at < now() - interval '2 hours');

  delete from public.slow_rooms
  where status = 'abandoned' and updated_at < now() - interval '7 days';
$$;


create or replace function public.create_slow_room(
  p_name    text,
  p_public  boolean default false,
  p_rounds  int     default 5,
  p_timer   boolean default true,
  p_version text    default 'g1'
)
returns public.slow_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  perform public.tidy_slow_rooms();

  insert into public.slow_rooms (code, host_id, seed, rounds, timer_enabled, is_public,
                                 generator_version, roster)
  values (
    public.new_room_code(),
    auth.uid(),
    'spellcast:' || p_version || ':slow:' || gen_random_uuid()::text,
    greatest(1, least(10, p_rounds)),
    coalesce(p_timer, true),
    coalesce(p_public, false),
    p_version,
    jsonb_build_array(jsonb_build_object(
      'uid',   auth.uid(),
      'id',    auth.uid(),
      'name',  coalesce(nullif(trim(p_name), ''), 'Player'),
      'isBot', false
    ))
  )
  returning * into room;

  return room;
end;
$$;

create or replace function public.join_slow_room(p_code text, p_name text)
returns public.slow_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- Locked, so two people typing the same code at once cannot both be handed
  -- the last seat.
  select * into room
  from public.slow_rooms
  where code = upper(trim(p_code))
  for update;

  if room.id is null then
    raise exception 'no such room';
  end if;
  if room.status <> 'lobby' then
    raise exception 'that game has already started';
  end if;

  -- Rejoining is not an error - it is the reconnect path.
  if exists (
    select 1 from jsonb_array_elements(room.roster) seat
    where (seat->>'uid')::uuid = auth.uid()
  ) then
    return room;
  end if;

  if jsonb_array_length(room.roster) >= 6 then
    raise exception 'that game is full';
  end if;

  update public.slow_rooms
  set roster = roster || jsonb_build_object(
        'uid',   auth.uid(),
        'id',    auth.uid(),
        'name',  coalesce(nullif(trim(p_name), ''), 'Player'),
        'isBot', false
      ),
      updated_at = now()
  where id = room.id
  returning * into room;

  return room;
end;
$$;

-- Public matchmaking: take a seat in the oldest waiting public room, or open
-- one. SKIP LOCKED means two players arriving together land in the same room if
-- there is space and different rooms if there is not, rather than deadlocking.
create or replace function public.find_slow_room(
  p_name    text,
  p_rounds  int     default 5,
  p_timer   boolean default true,
  p_version text    default 'g1'
)
returns public.slow_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  perform public.tidy_slow_rooms();

  -- Already waiting in a public lobby? Hand that one back - the reconnect path,
  -- as join_slow_room does. Without this, backing out of the lobby with the
  -- hardware button (which does not free your seat) and searching again opened
  -- a second room and left a ghost player sitting in the first, where the next
  -- stranger matched in would wait for somebody who was gone.
  select * into room
  from public.slow_rooms
  where is_public
    and status = 'lobby'
    and generator_version = p_version
    and created_at > now() - interval '15 minutes'
    and exists (
      select 1 from jsonb_array_elements(roster) seat
      where (seat->>'uid')::uuid = auth.uid()
    )
  order by created_at desc
  limit 1;

  if room.id is not null then
    return room;
  end if;

  select * into room
  from public.slow_rooms
  where is_public
    and status = 'lobby'
    and generator_version = p_version
    and jsonb_array_length(roster) < 6
    and created_at > now() - interval '15 minutes'
    and not exists (
      select 1 from jsonb_array_elements(roster) seat
      where (seat->>'uid')::uuid = auth.uid()
    )
  order by jsonb_array_length(roster) desc, created_at asc
  limit 1
  for update skip locked;

  if room.id is null then
    return public.create_slow_room(p_name, true, p_rounds, p_timer, p_version);
  end if;

  update public.slow_rooms
  set roster = roster || jsonb_build_object(
        'uid',   auth.uid(),
        'id',    auth.uid(),
        'name',  coalesce(nullif(trim(p_name), ''), 'Player'),
        'isBot', false
      ),
      updated_at = now()
  where id = room.id
  returning * into room;

  return room;
end;
$$;

-- Host only. Seats any bots requested, then flips to 'playing' - which is the
-- moment the move-insert policy starts allowing writes.
create or replace function public.start_slow_room(p_room uuid, p_bots jsonb default '[]'::jsonb)
returns public.slow_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  select * into room from public.slow_rooms where id = p_room for update;

  if room.id is null then
    raise exception 'no such room';
  end if;
  if room.host_id <> auth.uid() then
    raise exception 'only the host can start';
  end if;
  if room.status <> 'lobby' then
    return room;
  end if;
  if jsonb_array_length(room.roster) + jsonb_array_length(coalesce(p_bots, '[]'::jsonb)) < 2 then
    raise exception 'needs at least two players';
  end if;

  update public.slow_rooms
  set roster     = roster || coalesce(p_bots, '[]'::jsonb),
      status     = 'playing',
      started_at = now(),
      updated_at = now()
  where id = room.id
  returning * into room;

  return room;
end;
$$;

-- Idempotent: whoever's device notices the end first writes the standings, and
-- everyone else's write is a no-op. Results are what the lobby reads to show
-- first, second, third.
create or replace function public.finish_slow_room(p_room uuid, p_results jsonb)
returns setof public.slow_results
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  select * into room from public.slow_rooms where id = p_room for update;

  if room.id is null then
    raise exception 'no such room';
  end if;
  if not public.in_slow_roster(p_room) then
    raise exception 'not your game';
  end if;

  if room.status <> 'finished' then
    insert into public.slow_results
      (room_id, player_id, display_name, is_bot, rank, total, score, gems,
       word_count, best_word, best_word_score)
    select
      p_room,
      nullif(entry->>'uid', '')::uuid,
      coalesce(entry->>'name', 'Player'),
      coalesce((entry->>'isBot')::boolean, false),
      (entry->>'rank')::int,
      (entry->>'total')::int,
      coalesce((entry->>'score')::int, 0),
      coalesce((entry->>'gems')::int, 0),
      coalesce((entry->>'wordCount')::int, 0),
      entry->>'bestWord',
      coalesce((entry->>'bestWordScore')::int, 0)
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) entry
    on conflict do nothing;

    update public.slow_rooms
    set status = 'finished', finished_at = now(), updated_at = now()
    where id = p_room;
  end if;

  return query select * from public.slow_results where room_id = p_room order by rank;
end;
$$;

-- Host only, lobby only: replaces the room's bots with this line-up, so adding,
-- removing and changing a bot's difficulty are all one call - and every phone in
-- the lobby sees it live, through the same realtime update as a player joining.
-- Humans keep their seats and their order; bots sit after them.
create or replace function public.set_slow_bots(p_room uuid, p_bots jsonb)
returns public.slow_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room   public.slow_rooms;
  humans jsonb;
  bots   jsonb := '[]'::jsonb;
  bot    jsonb;
  name   text;
  level  text;
begin
  select * into room from public.slow_rooms where id = p_room for update;

  if room.id is null then
    raise exception 'no such room';
  end if;
  if room.host_id is distinct from auth.uid() then
    raise exception 'only the host can change the bots';
  end if;
  if room.status <> 'lobby' then
    raise exception 'that game has already started';
  end if;

  select coalesce(jsonb_agg(seat), '[]'::jsonb) into humans
  from jsonb_array_elements(room.roster) seat
  where not coalesce((seat->>'isBot')::boolean, false);

  for bot in select * from jsonb_array_elements(coalesce(p_bots, '[]'::jsonb)) loop
    name  := left(trim(coalesce(bot->>'name', '')), 12);
    level := coalesce(bot->>'level', 'medium');
    if name = '' then
      raise exception 'a bot needs a name';
    end if;
    if level not in ('easy', 'medium', 'hard') then
      raise exception 'unknown difficulty %', level;
    end if;
    if exists (
      select 1 from jsonb_array_elements(humans || bots) seat
      where lower(seat->>'name') = lower(name)
    ) then
      raise exception 'two players cannot share a name';
    end if;
    bots := bots || jsonb_build_object(
      'uid', null, 'id', 'bot-' || lower(name), 'name', name, 'isBot', true, 'level', level
    );
  end loop;

  if jsonb_array_length(humans) + jsonb_array_length(bots) > 6 then
    raise exception 'that game is full';
  end if;

  update public.slow_rooms
  set roster = humans || bots, updated_at = now()
  where id = room.id
  returning * into room;

  return room;
end;
$$;

create or replace function public.leave_slow_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.slow_rooms;
begin
  select * into room from public.slow_rooms where id = p_room for update;
  if room.id is null or room.status <> 'lobby' then
    return; -- leaving a running game is a disconnect, not a roster change
  end if;

  update public.slow_rooms
  set roster = (
        select coalesce(jsonb_agg(seat), '[]'::jsonb)
        from jsonb_array_elements(room.roster) seat
        where (seat->>'uid')::uuid is distinct from auth.uid()
      ),
      updated_at = now()
  where id = room.id;

  -- If the host left, the next human to have joined becomes host - otherwise
  -- nobody left in the lobby could ever press Start.
  update public.slow_rooms r
  set host_id = (
        select (seat->>'uid')::uuid
        from jsonb_array_elements(r.roster) with ordinality as s(seat, n)
        where not coalesce((seat->>'isBot')::boolean, false)
        order by n
        limit 1
      )
  where r.id = room.id
    and r.host_id = auth.uid()
    -- Only when there is somebody to hand it to. host_id cannot be null, so
    -- without this the last human leaving made the whole call fail.
    and exists (
      select 1 from jsonb_array_elements(r.roster) seat
      where not coalesce((seat->>'isBot')::boolean, false)
    );

  -- A lobby with no humans left - empty, or only bots - is rubbish; mark it so
  -- matchmaking stops offering it.
  update public.slow_rooms r
  set status = 'abandoned'
  where r.id = room.id
    and not exists (
      select 1 from jsonb_array_elements(r.roster) seat
      where not coalesce((seat->>'isBot')::boolean, false)
    );
end;
$$;

-- --- who may call what ----------------------------------------------------

-- The room functions are SECURITY DEFINER, so they bypass row level security
-- and do their own checks - each refuses a caller with no auth.uid(). They are
-- closed to the signed-out `anon` role anyway, rather than leaning on those
-- checks: a request carrying only the anon key, with no sign-in, has no business
-- reaching them at all. Every player is signed in (anonymously), which makes
-- them `authenticated`, so the app loses nothing.
--
-- Postgres grants EXECUTE to PUBLIC by default and Supabase grants it to anon
-- explicitly, so both are revoked. Re-runnable: revoking twice is harmless.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.in_slow_roster(uuid)',
    'public.new_room_code()',
    'public.create_slow_room(text, boolean, integer, boolean, text)',
    'public.join_slow_room(text, text)',
    'public.find_slow_room(text, integer, boolean, text)',
    'public.start_slow_room(uuid, jsonb)',
    'public.finish_slow_room(uuid, jsonb)',
    'public.leave_slow_room(uuid)',
    'public.set_slow_bots(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$$;

-- new_room_code is only ever called from inside create_slow_room, which runs
-- as its owner; nobody needs to call it directly.
revoke execute on function public.new_room_code() from authenticated;
revoke execute on function public.tidy_slow_rooms() from public, anon, authenticated;

-- --- realtime --------------------------------------------------------------

-- Clients subscribe to inserts on slow_moves and updates on slow_rooms.
-- Without this the app waits forever and nothing ever arrives.
--
-- Guarded rather than a plain `alter publication ... add table`, which errors
-- if the table is already published - and this file promises to be re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'slow_moves'
  ) then
    alter publication supabase_realtime add table public.slow_moves;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'slow_rooms'
  ) then
    alter publication supabase_realtime add table public.slow_rooms;
  end if;
end
$$;
