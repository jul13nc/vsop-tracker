-- Serialize journal writes per gameday and reduce write operations to one RPC.
-- The existing trigger uses unqualified table names. Pin its own search path
-- so it also works when invoked by an RPC with an empty search path.
alter function public.assert_season_open() set search_path = public, pg_temp;

create function public.append_game_event(
  p_gameday_id text,
  p_type public.game_event_type,
  p_player_id text,
  p_payload jsonb default null
) returns public.game_events
language plpgsql security invoker set search_path = '' as $$
declare
  result public.game_events;
begin
  perform 1 from public.gamedays where id = p_gameday_id for update;
  if not found then raise exception 'Journée introuvable'; end if;

  if not exists (
    select 1 from public.gameday_players
    where gameday_id = p_gameday_id and player_id = p_player_id
  ) then raise exception 'Joueur absent de la journée'; end if;

  insert into public.game_events(gameday_id, seq, type, player_id, payload)
  select p_gameday_id, coalesce(max(seq), 0) + 1, p_type, p_player_id, p_payload
  from public.game_events where gameday_id = p_gameday_id
  returning * into result;

  if p_type <> 'undo' then
    update public.gamedays set status = 'live'
    where id = p_gameday_id and status = 'setup';
  end if;
  return result;
end;
$$;

create function public.undo_game_event(p_gameday_id text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  target public.game_events;
begin
  perform 1 from public.gamedays where id = p_gameday_id for update;
  if not found then raise exception 'Journée introuvable'; end if;

  select e.* into target from public.game_events e
  where e.gameday_id = p_gameday_id and e.type <> 'undo'
    and not exists (
      select 1 from public.game_events u
      where u.gameday_id = p_gameday_id and u.type = 'undo'
        and u.payload->>'undoEventId' = e.id::text
    )
  order by e.seq desc limit 1;
  if not found then return; end if;

  perform public.append_game_event(p_gameday_id, 'undo', target.player_id,
    jsonb_build_object('undoEventId', target.id, 'undoneType', target.type));
end;
$$;

-- Keep ranking rules in the tested TypeScript domain. Persist the complete
-- ranking atomically, using current season points and an optimistic journal check.
create function public.save_gameday_results(
  p_gameday_id text,
  p_expected_seq int,
  p_results jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  day public.gamedays;
  scheme jsonb;
  participant_count int;
begin
  select * into day from public.gamedays where id = p_gameday_id for update;
  if not found then raise exception 'Journée introuvable'; end if;
  select points_scheme into scheme from public.seasons
  where id = day.season_id for share;

  if p_expected_seq is distinct from (
    select coalesce(max(seq), 0) from public.game_events where gameday_id = p_gameday_id
  ) then
    raise exception 'La journée a changé. Relancez la validation.';
  end if;

  perform 1 from public.gameday_players where gameday_id = p_gameday_id for update;
  select count(*) into participant_count from public.gameday_players
  where gameday_id = p_gameday_id;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'Classement invalide';
  end if;
  if jsonb_array_length(p_results) <> participant_count or exists (
    select 1 from jsonb_to_recordset(p_results) as r(player_id text, final_rank int)
    where r.player_id is null or r.final_rank is null
      or r.final_rank < 1 or r.final_rank > participant_count
      or not exists (
        select 1 from public.gameday_players gp
        where gp.gameday_id = p_gameday_id and gp.player_id = r.player_id
      )
  ) or (select count(distinct player_id)
        from jsonb_to_recordset(p_results) as r(player_id text)) <> participant_count
    or (select count(distinct final_rank)
        from jsonb_to_recordset(p_results) as r(final_rank int)) <> participant_count then
    raise exception 'Classement incomplet ou invalide';
  end if;

  update public.gameday_players gp
  set final_rank = r.final_rank,
      points = coalesce((scheme->>(r.final_rank - 1))::int, 0)
        * case when day.counts_double then 2 else 1 end
  from jsonb_to_recordset(p_results) as r(player_id text, final_rank int)
  where gp.gameday_id = p_gameday_id and gp.player_id = r.player_id;
  update public.gamedays set status = 'validated' where id = p_gameday_id;
end;
$$;

revoke execute on function public.append_game_event(text, public.game_event_type, text, jsonb) from public, anon;
revoke execute on function public.undo_game_event(text) from public, anon;
revoke execute on function public.save_gameday_results(text, int, jsonb) from public, anon;
grant execute on function public.append_game_event(text, public.game_event_type, text, jsonb) to authenticated;
grant execute on function public.undo_game_event(text) to authenticated;
grant execute on function public.save_gameday_results(text, int, jsonb) to authenticated;

-- Match public season lists, active-day lookup, and undo anti-joins.
create index gamedays_season_date_idx on public.gamedays(season_id, date desc);
create index gamedays_active_date_idx on public.gamedays(date desc)
  where status in ('setup', 'live');
create index gamedays_finished_date_idx on public.gamedays(date desc)
  where status = 'finished';
create index game_events_undo_target_idx on public.game_events(gameday_id, (payload->>'undoEventId'))
  where type = 'undo';
