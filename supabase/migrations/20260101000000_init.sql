-- VSOP Poker Championship Tracker — initial schema
-- Human-readable text ids throughout (player slugs, season "2026-2027", gameday dates).

-- =========================================================================
-- Enums
-- =========================================================================
create type gameday_status as enum ('setup', 'live', 'finished', 'validated');
create type game_event_type as enum ('rebuy', 'elimination', 'seven_two', 'undo');

-- =========================================================================
-- Tables
-- =========================================================================
create table players (
  id           text primary key,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table seasons (
  id              text primary key,          -- e.g. "2026-2027"
  label           text not null,             -- e.g. "2026/2027"
  buyin_cents     int  not null default 1000,
  payout_table    jsonb not null default '{
    "50":{"1":30,"2":20},
    "60":{"1":40,"2":20},
    "70":{"1":40,"2":20,"3":10},
    "80":{"1":40,"2":30,"3":10},
    "90":{"1":50,"2":30,"3":10},
    "100":{"1":60,"2":30,"3":10},
    "110":{"1":70,"2":30,"3":10},
    "120":{"1":70,"2":40,"3":10},
    "130":{"1":80,"2":40,"3":10},
    "140":{"1":90,"2":40,"3":10}
  }'::jsonb,
  chip_config     jsonb not null default '[
    {"name":"Vert","value":25,"count":12},
    {"name":"Noir","value":100,"count":12},
    {"name":"Violet","value":500,"count":7}
  ]'::jsonb,
  points_scheme   jsonb not null default '[10,7,5,3,2,1]'::jsonb,
  blind_level_minutes int not null default 20,
  blind_structure jsonb not null default '[
    {"level":1,"small":25,"big":50},
    {"level":2,"small":50,"big":100},
    {"level":3,"small":75,"big":150},
    {"level":4,"small":100,"big":200},
    {"level":5,"small":150,"big":300},
    {"level":6,"small":200,"big":400},
    {"level":7,"small":250,"big":500},
    {"level":8,"small":300,"big":600},
    {"level":9,"small":400,"big":800},
    {"level":10,"small":600,"big":1200},
    {"level":11,"small":1200,"big":2400},
    {"level":12,"small":2000,"big":4000},
    {"level":13,"small":3000,"big":6000},
    {"level":14,"small":4000,"big":8000}
  ]'::jsonb,
  is_closed       boolean not null default false,
  created_at      timestamptz not null default now()
);

create table gamedays (
  id            text primary key,            -- e.g. "2026-2027-2026-11-14"
  season_id     text not null references seasons(id) on delete cascade,
  date          date not null,
  counts_double boolean not null default false,
  status        gameday_status not null default 'setup',
  created_at    timestamptz not null default now()
);
create index gamedays_season_idx on gamedays(season_id);

create table gameday_players (
  gameday_id        text not null references gamedays(id) on delete cascade,
  player_id         text not null references players(id) on delete restrict,
  rebuys            int  not null default 0,
  first_rebuy_order int,
  eliminated_order  int,
  final_rank        int,
  points            int,
  primary key (gameday_id, player_id)
);

create table game_events (
  id         bigserial primary key,
  gameday_id text not null references gamedays(id) on delete cascade,
  seq        int  not null,
  type       game_event_type not null,
  player_id  text not null references players(id) on delete restrict,
  payload    jsonb,
  created_at timestamptz not null default now(),
  unique (gameday_id, seq)
);
create index game_events_gameday_idx on game_events(gameday_id, seq);

create table tournament_clock (
  gameday_id             text primary key references gamedays(id) on delete cascade,
  current_level          int  not null default 1,
  is_running             boolean not null default false,
  level_started_at       timestamptz,
  paused_elapsed_seconds int  not null default 0,
  updated_at             timestamptz not null default now()
);

-- =========================================================================
-- Standings view (season aggregate consumed by public pages)
-- =========================================================================
create view season_standings as
select
  g.season_id,
  gp.player_id,
  p.display_name,
  coalesce(sum(gp.points), 0)::int as total_points,
  count(gp.points) filter (where gp.points is not null)::int as gamedays_played,
  (
    select count(*)::int
    from game_events e
    join gamedays g2 on g2.id = e.gameday_id
    where e.type = 'seven_two'
      and g2.season_id = g.season_id
      and e.player_id = gp.player_id
      and not exists (
        select 1 from game_events u
        where u.gameday_id = e.gameday_id
          and u.type = 'undo'
          and (u.payload->>'undoEventId')::bigint = e.id
      )
  ) as seven_two_count
from gameday_players gp
join gamedays g on g.id = gp.gameday_id
join players  p on p.id = gp.player_id
group by g.season_id, gp.player_id, p.display_name;

-- =========================================================================
-- Row Level Security
--   anon      : read-only everywhere (public pages, public clock)
--   authenticated : full write access (single admin account)
-- =========================================================================
alter table players          enable row level security;
alter table seasons          enable row level security;
alter table gamedays         enable row level security;
alter table gameday_players  enable row level security;
alter table game_events      enable row level security;
alter table tournament_clock enable row level security;

-- Public read
create policy "public read players"   on players          for select using (true);
create policy "public read seasons"   on seasons          for select using (true);
create policy "public read gamedays"  on gamedays         for select using (true);
create policy "public read gp"        on gameday_players  for select using (true);
create policy "public read events"    on game_events      for select using (true);
create policy "public read clock"     on tournament_clock for select using (true);

-- Authenticated write (insert/update/delete)
create policy "auth write players"   on players          for all to authenticated using (true) with check (true);
create policy "auth write seasons"   on seasons          for all to authenticated using (true) with check (true);
create policy "auth write gamedays"  on gamedays         for all to authenticated using (true) with check (true);
create policy "auth write gp"        on gameday_players  for all to authenticated using (true) with check (true);
create policy "auth write events"    on game_events      for all to authenticated using (true) with check (true);
create policy "auth write clock"     on tournament_clock for all to authenticated using (true) with check (true);

-- =========================================================================
-- Guard: block writes to gamedays/events of a closed season
-- =========================================================================
create or replace function assert_season_open() returns trigger as $$
declare
  closed boolean;
  sid text;
begin
  if tg_table_name = 'gamedays' then
    sid := coalesce(new.season_id, old.season_id);
  else
    select season_id into sid from gamedays
      where id = coalesce(new.gameday_id, old.gameday_id);
  end if;

  select is_closed into closed from seasons where id = sid;
  if closed then
    raise exception 'Season % is closed; writes are not allowed.', sid;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger guard_gamedays
  before insert or update or delete on gamedays
  for each row execute function assert_season_open();

create trigger guard_gp
  before insert or update or delete on gameday_players
  for each row execute function assert_season_open();

create trigger guard_events
  before insert or update or delete on game_events
  for each row execute function assert_season_open();

-- Realtime publication for live sync
alter publication supabase_realtime add table game_events;
alter publication supabase_realtime add table gameday_players;
alter publication supabase_realtime add table tournament_clock;
alter publication supabase_realtime add table gamedays;
