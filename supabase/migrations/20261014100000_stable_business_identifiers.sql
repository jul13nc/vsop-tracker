create extension if not exists unaccent with schema extensions;

create function public.member_key(p_name text)
returns text language plpgsql stable set search_path = '' as $$
declare v_key text;
begin
  v_key := regexp_replace(extensions.unaccent(lower(split_part(trim(p_name), ' ', 1))), '[^a-z0-9-]', '', 'g');
  if v_key = '' then raise exception 'Player first name must contain ASCII letters or digits' using errcode='22023'; end if;
  return v_key;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.members
    group by public.member_key(name) having count(*) > 1
  ) then
    raise exception 'Cannot migrate player identifiers: first names collide after accent removal';
  end if;
  if exists (
    select played_at from public.sessions group by played_at having count(*) > 1
  ) then
    raise exception 'Cannot migrate session identifiers: more than one session exists on a date';
  end if;
end;
$$;

create temporary table _member_identifier_map (
  old_id uuid primary key,
  new_id text not null unique
) on commit drop;
insert into _member_identifier_map(old_id, new_id)
select id, public.member_key(name) from public.members;

drop function public.create_season(integer);
drop function public.create_session(uuid, date, uuid[]);
drop function public.record_session_event(uuid, uuid, public.session_event_type);
drop function public.close_season(uuid);
drop function public.create_public_standings_link(uuid);

drop trigger guard_seasons on public.seasons;
drop trigger guard_config on public.season_configurations;
drop trigger guard_members on public.members;
drop trigger guard_sessions on public.sessions;
drop trigger guard_players on public.session_players;
drop trigger guard_events on public.session_events;

alter table public.seasons add column id_stable integer;
update public.seasons set id_stable = start_year;
alter table public.public_standings_links add column season_id_stable integer;
update public.public_standings_links link set season_id_stable = season.start_year
from public.seasons season where season.id = link.season_id;
alter table public.season_configurations add column season_id_stable integer;
update public.season_configurations config set season_id_stable = season.start_year
from public.seasons season where season.id = config.season_id;
update public.sessions game
set configuration_snapshot = jsonb_set(game.configuration_snapshot, '{season_id}', to_jsonb(season.start_year::text))
from public.seasons season where season.id = game.season_id;
alter table public.sessions add column season_id_stable integer;
update public.sessions game set season_id_stable = season.start_year
from public.seasons season where season.id = game.season_id;

alter table public.members add column id_stable text;
update public.members member set id_stable = mapping.new_id
from _member_identifier_map mapping where mapping.old_id = member.id;
alter table public.session_players add column member_id_stable text;
update public.session_players player set member_id_stable = mapping.new_id
from _member_identifier_map mapping where mapping.old_id = player.member_id;
alter table public.session_events add column member_id_stable text;
update public.session_events event set member_id_stable = mapping.new_id
from _member_identifier_map mapping where mapping.old_id = event.member_id;

alter table public.sessions add column id_stable text;
update public.sessions set id_stable = to_char(played_at, 'YYYYMMDD');
alter table public.session_players add column session_id_stable text;
update public.session_players player set session_id_stable = game.id_stable
from public.sessions game where game.id = player.session_id;
alter table public.session_events add column session_id_stable text;
update public.session_events event set session_id_stable = game.id_stable
from public.sessions game where game.id = event.session_id;

alter table public.public_standings_links drop constraint public_standings_links_season_id_fkey;
alter table public.season_configurations drop constraint season_configurations_pkey;
alter table public.sessions drop constraint sessions_season_id_fkey;
alter table public.session_players drop constraint session_players_pkey;
alter table public.session_players drop constraint session_players_session_id_fkey;
alter table public.session_players drop constraint session_players_member_id_fkey;
alter table public.session_events drop constraint session_events_session_id_member_id_fkey;
alter table public.session_events drop constraint session_events_session_id_sequence_number_key;

alter table public.seasons drop constraint seasons_pkey;
alter table public.members drop constraint members_pkey;
alter table public.sessions drop constraint sessions_pkey;

alter table public.seasons drop column id;
alter table public.seasons rename column id_stable to id;
alter table public.seasons alter column id set not null;
alter table public.seasons add primary key (id);

alter table public.public_standings_links drop column season_id;
alter table public.public_standings_links rename column season_id_stable to season_id;
alter table public.public_standings_links alter column season_id set not null;
alter table public.public_standings_links add foreign key (season_id) references public.seasons(id) on delete cascade;

alter table public.season_configurations drop column season_id;
alter table public.season_configurations rename column season_id_stable to season_id;
alter table public.season_configurations alter column season_id set not null;
alter table public.season_configurations add primary key (season_id);
alter table public.season_configurations add foreign key (season_id) references public.seasons(id) on delete cascade;

alter table public.members drop column id;
alter table public.members rename column id_stable to id;
alter table public.members alter column id set not null;
alter table public.members add primary key (id);

alter table public.sessions drop column id;
alter table public.sessions rename column id_stable to id;
alter table public.sessions alter column id set not null;
alter table public.sessions drop column season_id;
alter table public.sessions rename column season_id_stable to season_id;
alter table public.sessions alter column season_id set not null;
alter table public.sessions add primary key (id);
alter table public.sessions add foreign key (season_id) references public.seasons(id);
alter table public.sessions add constraint sessions_played_at_key unique (played_at);

alter table public.session_players drop column session_id;
alter table public.session_players rename column session_id_stable to session_id;
alter table public.session_players alter column session_id set not null;
alter table public.session_players drop column member_id;
alter table public.session_players rename column member_id_stable to member_id;
alter table public.session_players alter column member_id set not null;
alter table public.session_players add primary key (session_id, member_id);
alter table public.session_players add foreign key (session_id) references public.sessions(id) on delete cascade;
alter table public.session_players add foreign key (member_id) references public.members(id);

alter table public.session_events drop column session_id;
alter table public.session_events rename column session_id_stable to session_id;
alter table public.session_events alter column session_id set not null;
alter table public.session_events drop column member_id;
alter table public.session_events rename column member_id_stable to member_id;
alter table public.session_events alter column member_id set not null;
alter table public.session_events add foreign key (session_id, member_id) references public.session_players(session_id, member_id);
alter table public.session_events add constraint session_events_session_id_sequence_number_key unique (session_id, sequence_number);

create function public.set_member_identifier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.id := public.member_key(new.name);
  elsif public.member_key(new.name) <> old.id then
    raise exception 'Player identifier must match first name' using errcode='55000';
  elsif new.id is distinct from old.id then
    raise exception 'Player identifier is immutable' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger set_member_identifier before insert or update on public.members
  for each row execute function public.set_member_identifier();

create function public.set_season_identifier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.id := new.start_year;
  elsif new.id is distinct from old.id or new.start_year is distinct from old.start_year then
    raise exception 'Season identifier is immutable' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger set_season_identifier before insert or update on public.seasons
  for each row execute function public.set_season_identifier();

create function public.set_session_identifier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.id := to_char(new.played_at, 'YYYYMMDD');
  elsif new.id is distinct from old.id or new.played_at is distinct from old.played_at then
    raise exception 'Session identifier is immutable' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger set_session_identifier before insert or update on public.sessions
  for each row execute function public.set_session_identifier();

create or replace function public.create_season(p_start_year integer)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if p_start_year not between 2000 and 2198 then raise exception 'School year must be between 2000 and 2198' using errcode = '22023'; end if;
  insert into public.seasons(id, start_year) values (p_start_year, p_start_year);
  insert into public.season_configurations(season_id) values (p_start_year);
  return p_start_year;
end;
$$;
alter function public.create_season(integer) owner to postgres;

create function public.create_session(p_season_id integer, p_played_at date, p_member_ids text[])
returns text language plpgsql security definer set search_path = '' as $$
declare v_id text; v_config jsonb;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if not exists(select 1 from public.seasons where id=p_season_id and status='open') then raise exception 'Open season required' using errcode = '22023'; end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then raise exception 'Select at least one participant' using errcode = '22023'; end if;
  if exists(select 1 from public.sessions where played_at=p_played_at) then raise exception 'A session already exists on this date' using errcode = '23505'; end if;
  select to_jsonb(c) into v_config from public.season_configurations c where c.season_id=p_season_id;
  v_id := to_char(p_played_at, 'YYYYMMDD');
  insert into public.sessions(id, season_id, played_at, configuration_snapshot)
  values (v_id, p_season_id, p_played_at, v_config);
  insert into public.session_players(session_id,member_id)
  select v_id, member_id from (select distinct unnest(p_member_ids) as member_id) ids
  where exists(select 1 from public.members m where m.id=ids.member_id);
  if (select count(*) from public.session_players where session_id=v_id) <> (select count(distinct x) from unnest(p_member_ids) x) then
    raise exception 'Unknown participant selected' using errcode = '22023';
  end if;
  return v_id;
end;
$$;
alter function public.create_session(integer,date,text[]) owner to postgres;

create function public.record_session_event(p_session_id text, p_member_id text, p_event_type public.session_event_type)
returns public.session_events language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions;
  v_player public.session_players;
  v_amount numeric(8,2);
  v_rank integer;
  v_sequence bigint;
  v_result public.session_events;
  v_active integer;
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
        from public.session_events where session_id=p_session_id and event_type='elimination' group by member_id
      ), final_places as (
        select member_id, row_number() over(order by last_out desc) + 1 as final_rank from latest_eliminations
      )
      update public.session_players player set final_rank=places.final_rank, current_rank=places.final_rank
      from final_places places where player.session_id=p_session_id and player.member_id=places.member_id;
      update public.sessions set status='finished' where id=p_session_id;
    end if;
  end if;
  return v_result;
end;
$$;
alter function public.record_session_event(text,text,public.session_event_type) owner to postgres;

create function public.close_season(p_season_id integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode = '42501'; end if;
  if exists(select 1 from public.sessions where season_id=p_season_id and status='open') then raise exception 'Finish all sessions before closing season' using errcode = '55000'; end if;
  update public.seasons set status='closed' where id=p_season_id and status='open';
  if not found then raise exception 'Open season not found' using errcode = '22023'; end if;
end;
$$;
alter function public.close_season(integer) owner to postgres;

create function public.create_public_standings_link(p_season_id integer)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode='42501'; end if;
  if not exists(select 1 from public.seasons where id=p_season_id) then raise exception 'Season not found' using errcode='22023'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  insert into public.public_standings_links(token_hash,season_id,created_by)
  values (encode(extensions.digest(v_token,'sha256'),'hex'),p_season_id,auth.uid());
  return v_token;
end;
$$;
alter function public.create_public_standings_link(integer) owner to postgres;

create or replace function public.read_public_standings(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_season_id integer; v_result jsonb;
begin
  select season_id into v_season_id from public.public_standings_links
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null;
  if v_season_id is null then return null; end if;

  with first_rebuys as (
    select session_id, member_id, min(sequence_number) as first_sequence
    from public.session_events where event_type='rebuy' group by session_id, member_id
  ), ranked_results as (
    select session.id as session_id, player.member_id, member.name, session.played_at, player.final_rank,
      (rebuy.first_sequence is not null) as rebought,
      row_number() over (
        partition by session.id
        order by case when rebuy.first_sequence is null then 0 else 1 end,
          case when rebuy.first_sequence is null then player.final_rank end asc,
          case when rebuy.first_sequence is not null then rebuy.first_sequence end desc
      ) as annual_rank
    from public.sessions session
    join public.session_players player on player.session_id=session.id
    join public.members member on member.id=player.member_id
    left join first_rebuys rebuy on rebuy.session_id=session.id and rebuy.member_id=player.member_id
    where session.season_id=v_season_id and session.status='finished'
  ), earned_points as (
    select ranked.*, coalesce((configuration.points_by_rank->>ranked.annual_rank::text)::numeric,0) as points
    from ranked_results ranked cross join public.season_configurations configuration
    where configuration.season_id=v_season_id
  ), standings as (
    select name, sum(points) as total_points,
      jsonb_agg(jsonb_build_object('session_date',played_at,'rank',annual_rank,'points',points,'rebought',rebought) order by played_at) as sessions
    from earned_points group by name
  )
  select jsonb_build_object(
    'season', jsonb_build_object('start_year',season.start_year,'status',season.status),
    'standings',coalesce((select jsonb_agg(jsonb_build_object('name',name,'points',total_points,'sessions',sessions) order by total_points desc,name) from standings),'[]'::jsonb),
    'seven_two_standings',coalesce((
      select jsonb_agg(jsonb_build_object('name',seven_two.name,'wins',seven_two.wins) order by seven_two.wins desc,seven_two.name)
      from (
        select member.id,member.name,count(*) as wins from public.session_events event
        join ranked_results ranked on ranked.session_id=event.session_id and ranked.member_id=event.member_id
        join public.members member on member.id=event.member_id where event.event_type='seven_two'
        group by member.id,member.name
      ) seven_two
    ),'[]'::jsonb),
    'session_results',coalesce((
      select jsonb_agg(jsonb_build_object(
        'played_at',game.played_at,
        'payout_table',game.configuration_snapshot->'payout_table',
        'buy_in',game.configuration_snapshot->'buy_in',
        'pot',coalesce((
          select sum(entry.amount) from (
            select (game.configuration_snapshot->>'buy_in')::numeric as amount from public.session_players initial_player where initial_player.session_id=game.id
            union all select rebuy.amount from public.session_events rebuy where rebuy.session_id=game.id and rebuy.event_type='rebuy'
          ) entry
        ),0),
        'players',coalesce((
          select jsonb_agg(jsonb_build_object(
            'name',member.name,'rank',player.final_rank,
            'rebought',exists(select 1 from public.session_events event where event.session_id=game.id and event.member_id=player.member_id and event.event_type='rebuy')
          ) order by player.final_rank)
          from public.session_players player join public.members member on member.id=player.member_id where player.session_id=game.id
        ),'[]'::jsonb)
      ) order by game.played_at desc) from public.sessions game where game.season_id=v_season_id and game.status='finished'
    ),'[]'::jsonb)
  ) into v_result from public.seasons season where season.id=v_season_id;
  return v_result;
end;
$$;
alter function public.read_public_standings(text) owner to postgres;

create or replace function public.guard_championship_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_season_id integer; v_status public.season_status; v_session_id text; v_session_status public.session_status;
begin
  if public.current_role() is distinct from 'organizer' then raise exception 'Organizer role required' using errcode='42501'; end if;
  if tg_table_name='members' then
    if tg_op<>'INSERT' and exists (
      select 1 from public.session_players sp join public.sessions s on s.id=sp.session_id
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
      if v_session_status='finished' and tg_op='UPDATE' and old.status='finished' then raise exception 'Session is read only' using errcode='55000'; end if;
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

revoke all on function public.create_season(integer), public.create_session(integer,date,text[]), public.record_session_event(text,text,public.session_event_type), public.close_season(integer), public.invite_reader(text) from public, anon;
grant execute on function public.create_season(integer), public.create_session(integer,date,text[]), public.record_session_event(text,text,public.session_event_type), public.close_season(integer), public.invite_reader(text), public.current_role() to authenticated;
revoke all on function public.create_public_standings_link(integer), public.revoke_public_standings_link(text), public.read_public_standings(text) from public, anon;
grant execute on function public.create_public_standings_link(integer), public.revoke_public_standings_link(text) to authenticated;
grant execute on function public.read_public_standings(text) to anon, authenticated;

notify pgrst, 'reload schema';
