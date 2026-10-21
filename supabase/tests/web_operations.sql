-- Executed against a disposable database by run_web_operations.py.
insert into public.players(id, display_name) values ('alice', 'Alice'), ('bob', 'Bob');
insert into public.seasons(id, label) values ('test', 'Test');
insert into public.gamedays(id, season_id, date, counts_double)
values ('day', 'test', '2026-10-21', true), ('parallel', 'test', '2026-10-22', false);
insert into public.gameday_players(gameday_id, player_id)
values ('day', 'alice'), ('day', 'bob'), ('parallel', 'alice');

set role authenticated;
do $$
declare
  first_event public.game_events;
  second_event public.game_events;
  undone_id bigint;
begin
  first_event := public.append_game_event('day', 'rebuy', 'alice');
  second_event := public.append_game_event('day', 'seven_two', 'bob');
  assert first_event.seq = 1 and second_event.seq = 2, 'Sequences must increase';
  assert (select status = 'live' from public.gamedays where id = 'day'), 'First event starts day';

  perform public.undo_game_event('day');
  select (payload->>'undoEventId')::bigint into undone_id from public.game_events
  where gameday_id = 'day' and seq = 3;
  assert undone_id = second_event.id, 'Undo targets last active event';
  perform public.undo_game_event('day');
  select (payload->>'undoEventId')::bigint into undone_id from public.game_events
  where gameday_id = 'day' and seq = 4;
  assert undone_id = first_event.id, 'Undo skips previously undone events';
  perform public.undo_game_event('day');
  assert (select count(*) = 4 from public.game_events where gameday_id = 'day'), 'Empty undo is a no-op';

  begin
    perform public.save_gameday_results('day', 3,
      '[{"player_id":"alice","final_rank":1},{"player_id":"bob","final_rank":2}]');
    raise exception 'Expected stale-journal rejection';
  exception when raise_exception then
    if sqlerrm <> 'La journée a changé. Relancez la validation.' then raise; end if;
  end;
  assert (select bool_and(points is null) from public.gameday_players where gameday_id = 'day'),
    'Stale validation leaves every score untouched';

  begin
    perform public.save_gameday_results('day', 4,
      '[{"player_id":"alice","final_rank":1},{"player_id":"bob","final_rank":1}]');
    raise exception 'Expected duplicate-rank rejection';
  exception when raise_exception then
    if sqlerrm <> 'Classement incomplet ou invalide' then raise; end if;
  end;
  begin
    perform public.save_gameday_results('day', 4, '[{"player_id":"alice","final_rank":1}]');
    raise exception 'Expected incomplete-ranking rejection';
  exception when raise_exception then
    if sqlerrm <> 'Classement incomplet ou invalide' then raise; end if;
  end;

  perform public.save_gameday_results('day', 4,
    '[{"player_id":"alice","final_rank":1},{"player_id":"bob","final_rank":2}]');
  assert (select points = 20 and final_rank = 1 from public.gameday_players
    where gameday_id = 'day' and player_id = 'alice'), 'Double points for winner';
  assert (select points = 14 and final_rank = 2 from public.gameday_players
    where gameday_id = 'day' and player_id = 'bob'), 'Double points for runner-up';
  assert (select status = 'validated' from public.gamedays where id = 'day'), 'Status commits with scores';

  update public.seasons set is_closed = true where id = 'test';
  begin
    perform public.save_gameday_results('day', 4,
      '[{"player_id":"alice","final_rank":2},{"player_id":"bob","final_rank":1}]');
    raise exception 'Expected closed-season rejection';
  exception when raise_exception then
    if sqlerrm not like 'Season % is closed%' then raise; end if;
  end;
  assert (select points = 20 from public.gameday_players
    where gameday_id = 'day' and player_id = 'alice'), 'Failed validation rolls back scores';
  update public.seasons set is_closed = false where id = 'test';
end;
$$;
reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.append_game_event(text,public.game_event_type,text,jsonb)', 'execute');
  assert not has_function_privilege('anon', 'public.undo_game_event(text)', 'execute');
  assert not has_function_privilege('anon', 'public.save_gameday_results(text,integer,jsonb)', 'execute');
end;
$$;
