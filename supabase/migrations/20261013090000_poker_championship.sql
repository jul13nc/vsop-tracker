create extension if not exists pgcrypto;

create type public.account_role as enum ('organizer', 'reader');
create type public.season_status as enum ('open', 'closed');
create type public.session_status as enum ('open', 'finished');
create type public.player_status as enum ('active', 'eliminated');
create type public.session_event_type as enum ('rebuy', 'elimination', 'seven_two');

create table public.reader_invitations (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now(),
  invited_by uuid not null references auth.users(id)
);

revoke all on public.reader_invitations from anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.account_role,
  created_at timestamptz not null default now()
);

create function public.current_role()
returns public.account_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = (select auth.uid())
$$;
alter function public.current_role() owner to postgres;

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_role public.account_role;
begin
  select 'reader'::public.account_role into v_role
  from public.reader_invitations where email = lower(trim(new.email));
  insert into public.profiles(user_id, email, role)
  values (new.id, lower(trim(new.email)), v_role)
  on conflict (user_id) do update set email = excluded.email, role = coalesce(public.profiles.role, excluded.role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.invite_reader(p_email text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user auth.users;
begin
  if public.current_role() is distinct from 'organizer' then
    raise exception 'Organizer role required' using errcode = '42501';
  end if;
  if p_email is null or trim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Valid email required' using errcode = '22023';
  end if;
  if exists(select 1 from public.profiles where email=lower(trim(p_email)) and role='organizer') then
    raise exception 'Organizer account cannot be invited as reader' using errcode='22023';
  end if;
  if exists(select 1 from public.reader_invitations where email=lower(trim(p_email)))
     and not exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then
    raise exception 'An invitation for this email is already pending' using errcode='23505';
  end if;
  insert into public.reader_invitations(email, invited_by)
  values (lower(trim(p_email)), auth.uid())
  on conflict (email) do update set invited_by = excluded.invited_by, created_at = now();
  select * into v_user from auth.users where lower(email) = lower(trim(p_email));
  if found then
    insert into public.profiles(user_id, email, role)
    values (v_user.id, lower(trim(p_email)), 'reader')
    on conflict (user_id) do update set email = excluded.email, role = coalesce(public.profiles.role, 'reader');
  end if;
end;
$$;
alter function public.invite_reader(text) owner to postgres;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  start_year integer not null unique check (start_year between 2000 and 2198),
  status public.season_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.season_configurations (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  buy_in numeric(8,2) not null default 10 check (buy_in > 0),
  chips jsonb not null default '[{"label":"Vert","value":25,"quantity":12},{"label":"Noir","value":100,"quantity":12},{"label":"Violet","value":500,"quantity":7}]'::jsonb,
  payout_table jsonb not null default '{"50":{"1":30,"2":20},"60":{"1":40,"2":20},"70":{"1":40,"2":20,"3":10},"80":{"1":40,"2":30,"3":10},"90":{"1":50,"2":30,"3":10},"100":{"1":60,"2":30,"3":10},"110":{"1":70,"2":30,"3":10},"120":{"1":70,"2":40,"3":10},"130":{"1":80,"2":40,"3":10},"140":{"1":90,"2":40,"3":10}}'::jsonb,
  points_by_rank jsonb not null default '{"1":10,"2":7,"3":5,"4":3,"5":2,"6":1}'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(chips) = 'array'),
  check (jsonb_typeof(payout_table) = 'object'),
  check (jsonb_typeof(points_by_rank) = 'object')
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  played_at date not null,
  status public.session_status not null default 'open',
  configuration_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.session_players (
  session_id uuid not null references public.sessions(id) on delete cascade,
  member_id uuid not null references public.members(id),
  status public.player_status not null default 'active',
  current_rank integer,
  final_rank integer,
  first_rebuy_rank integer,
  primary key (session_id, member_id),
  check (current_rank is null or current_rank > 0),
  check (final_rank is null or final_rank > 0),
  check (first_rebuy_rank is null or first_rebuy_rank > 0)
);

create table public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  member_id uuid not null,
  sequence_number bigint not null,
  event_type public.session_event_type not null,
  amount numeric(8,2) not null default 0 check (amount >= 0),
  rank_at_event integer,
  created_at timestamptz not null default now(),
  foreign key (session_id, member_id) references public.session_players(session_id, member_id),
  unique (session_id, sequence_number)
);

create function public.touch_session()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'finished' and old.status = 'open' then
    if (select count(*) from public.session_players where session_id = new.id and status = 'active') <> 1 then
      raise exception 'A session can finish only when one player remains' using errcode = '22023';
    end if;
    update public.session_players set final_rank = 1, current_rank = 1
    where session_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;
create trigger finish_session_guard before update of status on public.sessions
  for each row execute function public.touch_session();

create function public.create_season(p_start_year integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if p_start_year not between 2000 and 2198 then raise exception 'School year must be between 2000 and 2198' using errcode = '22023'; end if;
  insert into public.seasons(start_year) values (p_start_year) returning id into v_id;
  insert into public.season_configurations(season_id) values (v_id);
  return v_id;
end;
$$;
alter function public.create_season(integer) owner to postgres;

create function public.create_session(p_season_id uuid, p_played_at date, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_config jsonb;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if not exists(select 1 from public.seasons where id=p_season_id and status='open') then raise exception 'Open season required' using errcode = '22023'; end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then raise exception 'Select at least one participant' using errcode = '22023'; end if;
  select to_jsonb(c) into v_config from public.season_configurations c where c.season_id=p_season_id;
  insert into public.sessions(season_id, played_at, configuration_snapshot)
  values (p_season_id,p_played_at,v_config) returning id into v_id;
  insert into public.session_players(session_id,member_id)
  select v_id, member_id from (select distinct unnest(p_member_ids) as member_id) ids
  where exists(select 1 from public.members m where m.id=ids.member_id);
  if (select count(*) from public.session_players where session_id=v_id) <> (select count(distinct x) from unnest(p_member_ids) x) then
    raise exception 'Unknown participant selected' using errcode = '22023';
  end if;
  return v_id;
end;
$$;
alter function public.create_session(uuid,date,uuid[]) owner to postgres;

create function public.record_session_event(p_session_id uuid, p_member_id uuid, p_event_type public.session_event_type)
returns public.session_events language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions;
  v_player public.session_players;
  v_amount numeric(8,2);
  v_rank integer;
  v_sequence bigint;
  v_result public.session_events;
  v_active integer;
  v_season_id uuid;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'Open session required' using errcode = '55000'; end if;
  select * into v_player from public.session_players where session_id=p_session_id and member_id=p_member_id for update;
  if not found then raise exception 'Session participant not found' using errcode = '22023'; end if;
  v_amount := case when p_event_type='rebuy' then (v_session.configuration_snapshot->>'buy_in')::numeric else 0 end;
  if p_event_type='rebuy' then
    if v_player.status <> 'eliminated' then raise exception 'Only eliminated players can rebuy' using errcode = '22023'; end if;
    v_rank := v_player.current_rank;
    update public.session_players set status='active', first_rebuy_rank=coalesce(first_rebuy_rank,v_rank), final_rank=null
    where session_id=p_session_id and member_id=p_member_id;
  elsif p_event_type='elimination' then
    if v_player.status <> 'active' then raise exception 'Only active players can be eliminated' using errcode = '22023'; end if;
    select count(*) into v_rank from public.session_players where session_id=p_session_id and status='active';
    update public.session_players set status='eliminated', current_rank=v_rank, final_rank=v_rank
    where session_id=p_session_id and member_id=p_member_id;
  elsif p_event_type='seven_two' then
    if v_player.status <> 'active' then raise exception 'Player must be active' using errcode = '22023'; end if;
  end if;
  select coalesce(max(sequence_number),0)+1 into v_sequence from public.session_events where session_id=p_session_id;
  insert into public.session_events(session_id,member_id,sequence_number,event_type,amount,rank_at_event)
  values(p_session_id,p_member_id,v_sequence,p_event_type,v_amount,v_rank) returning * into v_result;
  if p_event_type='elimination' then
    select count(*) into v_active from public.session_players where session_id=p_session_id and status='active';
    if v_active=1 then
      update public.session_players set final_rank=1,current_rank=1 where session_id=p_session_id and status='active';
      with latest_eliminations as (
        select member_id, max(sequence_number) as last_out
        from public.session_events
        where session_id=p_session_id and event_type='elimination'
        group by member_id
      ), final_places as (
        select member_id, row_number() over(order by last_out desc) + 1 as final_rank
        from latest_eliminations
      )
      update public.session_players player
      set final_rank=places.final_rank, current_rank=places.final_rank
      from final_places places
      where player.session_id=p_session_id and player.member_id=places.member_id;
      select season_id into v_season_id from public.sessions where id=p_session_id;
      update public.sessions set status='finished' where id=p_session_id;
    end if;
  end if;
  return v_result;
end;
$$;
alter function public.record_session_event(uuid,uuid,public.session_event_type) owner to postgres;

create function public.close_season(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if exists(select 1 from public.sessions where season_id=p_season_id and status='open') then raise exception 'Finish all sessions before closing season' using errcode = '55000'; end if;
  update public.seasons set status='closed' where id=p_season_id and status='open';
  if not found then raise exception 'Open season not found' using errcode = '22023'; end if;
end;
$$;
alter function public.close_season(uuid) owner to postgres;

create function public.validate_season_configuration()
returns trigger language plpgsql set search_path = '' as $$
declare v_pot text; v_entry jsonb; v_rank text; v_total numeric;
begin
  if jsonb_typeof(new.chips)<>'array' or jsonb_array_length(new.chips)=0 then raise exception 'Chip distribution must be a non-empty array' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(new.chips) c where coalesce(trim(c->>'label'),'')='' or coalesce((c->>'value')::numeric,0)<=0 or coalesce((c->>'quantity')::integer,0)<=0) then raise exception 'Each chip needs label, positive value and quantity' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(new.chips) c group by lower(c->>'label') having count(*)>1) then raise exception 'Chip labels must be unique' using errcode='22023'; end if;
  for v_pot in select jsonb_object_keys(new.payout_table) loop
    if v_pot !~ '^[1-9][0-9]*(\.[0-9]{1,2})?$' then raise exception 'Payout keys must be positive pot amounts with at most two decimals' using errcode='22023'; end if;
    v_entry := new.payout_table->v_pot;
    if jsonb_typeof(v_entry)<>'object' or not exists(select 1 from jsonb_each(v_entry)) then raise exception 'Each pot requires payout ranks' using errcode='22023'; end if;
    select sum(value::text::numeric) into v_total from jsonb_each(v_entry);
    if v_total <> v_pot::numeric then raise exception 'Payout values must add up to pot' using errcode='22023'; end if;
    if (select min(key::integer) from jsonb_each(v_entry))<>1 or (select max(key::integer) from jsonb_each(v_entry))<>(select count(*) from jsonb_each(v_entry)) then raise exception 'Payout ranks must be consecutive from first place' using errcode='22023'; end if;
    for v_rank in select jsonb_object_keys(v_entry) loop
      if v_rank !~ '^[1-9][0-9]*$' or coalesce((v_entry->>v_rank)::numeric,-1)<0 then raise exception 'Payout ranks and amounts must be non-negative' using errcode='22023'; end if;
    end loop;
  end loop;
  for v_rank in select jsonb_object_keys(new.points_by_rank) loop
    if v_rank !~ '^[1-9][0-9]*$' or coalesce((new.points_by_rank->>v_rank)::numeric,-1)<0 then raise exception 'Point ranks must be positive with non-negative points' using errcode='22023'; end if;
  end loop;
  return new;
end;
$$;
create trigger validate_season_configuration before insert or update on public.season_configurations
  for each row execute function public.validate_season_configuration();

create function public.guard_championship_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_season_id uuid; v_status public.season_status; v_session_id uuid; v_session_status public.session_status;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode='42501'; end if;
  if tg_table_name='members' then
    if tg_op<>'INSERT' and exists (
      select 1 from public.session_players sp
      join public.sessions s on s.id=sp.session_id
      where sp.member_id=coalesce(new.id,old.id) and s.status='finished'
    ) then raise exception 'Member has archived results and is read only' using errcode='55000'; end if;
    if tg_op='DELETE' then return old; else return new; end if;
  elsif tg_table_name='season_configurations' then v_season_id:=coalesce(new.season_id,old.season_id);
  elsif tg_table_name='seasons' then v_season_id:=coalesce(new.id,old.id);
  elsif tg_table_name='sessions' then v_season_id:=coalesce(new.season_id,old.season_id); v_session_id:=coalesce(new.id,old.id);
  else v_session_id:=coalesce(new.session_id,old.session_id); select season_id into v_season_id from public.sessions where id=v_session_id;
  end if;
  select status into v_status from public.seasons where id=v_season_id;
  if v_status='closed' then raise exception 'Season is read only' using errcode='55000'; end if;
  if v_session_id is not null then
    if tg_table_name='sessions' then
      select status into v_session_status from public.sessions where id=v_session_id;
      if v_session_status='finished' and tg_op='UPDATE' and old.status='finished' then
        raise exception 'Session is read only' using errcode='55000';
      end if;
      if tg_op='UPDATE' and old.status='open' and new.status='open'
         and (new.played_at is distinct from old.played_at or new.configuration_snapshot is distinct from old.configuration_snapshot)
         and exists(select 1 from public.session_players where session_id=v_session_id) then
        raise exception 'Session metadata cannot change after participants are added' using errcode='55000';
      end if;
    else
      select status into v_session_status from public.sessions where id=v_session_id;
      if v_session_status='finished' then raise exception 'Session is read only' using errcode='55000'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

create trigger guard_seasons before insert or update or delete on public.seasons for each row execute function public.guard_championship_write();
create trigger guard_config before insert or update or delete on public.season_configurations for each row execute function public.guard_championship_write();
create trigger guard_members before insert or update or delete on public.members for each row execute function public.guard_championship_write();
create trigger guard_sessions before insert or update or delete on public.sessions for each row execute function public.guard_championship_write();
create trigger guard_players before insert or update or delete on public.session_players for each row execute function public.guard_championship_write();
create trigger guard_events before insert or update or delete on public.session_events for each row execute function public.guard_championship_write();

alter table public.reader_invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.season_configurations enable row level security;
alter table public.members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.session_events enable row level security;

create policy "Profiles visible to self and organizers" on public.profiles for select to authenticated using (user_id=auth.uid() or public.current_role()='organizer');
create policy "Organizers manage reader invitations" on public.reader_invitations for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Championship visible to invited accounts" on public.seasons for select to authenticated using (public.current_role() is not null);
create policy "Season configuration visible to invited accounts" on public.season_configurations for select to authenticated using (public.current_role() is not null);
create policy "Members visible to invited accounts" on public.members for select to authenticated using (public.current_role() is not null);
create policy "Sessions visible to invited accounts" on public.sessions for select to authenticated using (public.current_role() is not null);
create policy "Session players visible to invited accounts" on public.session_players for select to authenticated using (public.current_role() is not null);
create policy "Session events visible to invited accounts" on public.session_events for select to authenticated using (public.current_role() is not null);
create policy "Organizers manage seasons" on public.seasons for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Organizers manage configurations" on public.season_configurations for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Organizers manage members" on public.members for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Organizers manage sessions" on public.sessions for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Organizers manage players" on public.session_players for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');
create policy "Organizers manage events" on public.session_events for all to authenticated using (public.current_role()='organizer') with check (public.current_role()='organizer');

grant usage on schema public to authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.profiles, public.seasons, public.season_configurations, public.members, public.sessions, public.session_players, public.session_events to authenticated;
grant select, insert, update, delete on public.reader_invitations to authenticated;
grant insert, update, delete on public.season_configurations to authenticated;
grant update on public.seasons to authenticated;
grant insert, update, delete on public.members to authenticated;
grant update on public.sessions, public.session_players to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on function public.create_season(integer), public.create_session(uuid,date,uuid[]), public.record_session_event(uuid,uuid,public.session_event_type), public.close_season(uuid), public.invite_reader(text) from public, anon;
grant execute on function public.create_season(integer), public.create_session(uuid,date,uuid[]), public.record_session_event(uuid,uuid,public.session_event_type), public.close_season(uuid), public.invite_reader(text), public.current_role() to authenticated;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.session_events;
  alter publication supabase_realtime add table public.session_players;
  alter publication supabase_realtime add table public.sessions;
exception when duplicate_object then null;
end $$;

-- Promote the first account manually after signup, using Supabase SQL editor:
-- update public.profiles set role = 'organizer' where email = 'organizer@example.com';
