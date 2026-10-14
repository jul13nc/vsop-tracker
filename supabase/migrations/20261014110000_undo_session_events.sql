create or replace function public.undo_session_event(p_event_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_session_id text;
  v_season_status public.season_status;
  v_event record;
  v_rank integer;
  v_active integer;
  v_last_event_type public.session_event_type;
begin
  if public.current_role() is distinct from 'organizer' then
    raise exception 'Organizer role required' using errcode='42501';
  end if;

  select event.session_id, season.status
  into v_session_id, v_season_status
  from public.session_events event
  join public.sessions session on session.id=event.session_id
  join public.seasons season on season.id=session.season_id
  where event.id=p_event_id
  for update of session;
  if not found then raise exception 'Session event not found' using errcode='22023'; end if;
  if v_season_status='closed' then raise exception 'Season is read only' using errcode='55000'; end if;

  perform set_config('app.undo_session_event', v_session_id, true);
  update public.sessions set status='open' where id=v_session_id and status='finished';
  delete from public.session_events where id=p_event_id;

  update public.session_players
  set status='active', current_rank=null, final_rank=null, first_rebuy_rank=null
  where session_id=v_session_id;

  for v_event in
    select * from public.session_events where session_id=v_session_id order by sequence_number
  loop
    v_last_event_type := v_event.event_type;
    if v_event.event_type='elimination' then
      select count(*) into v_rank from public.session_players where session_id=v_session_id and status='active';
      if v_rank < 2 then raise exception 'Cannot undo event: later eliminations are inconsistent' using errcode='22023'; end if;
      update public.session_players
      set status='eliminated', current_rank=v_rank, final_rank=v_rank
      where session_id=v_session_id and member_id=v_event.member_id and status='active';
      if not found then raise exception 'Cannot undo event: later eliminations are inconsistent' using errcode='22023'; end if;
      update public.session_events set rank_at_event=v_rank where id=v_event.id;
    elsif v_event.event_type='rebuy' then
      select current_rank into v_rank from public.session_players
      where session_id=v_session_id and member_id=v_event.member_id and status='eliminated';
      if not found then raise exception 'Cannot undo event: later rebuys are inconsistent' using errcode='22023'; end if;
      update public.session_players
      set status='active', first_rebuy_rank=coalesce(first_rebuy_rank,v_rank), final_rank=null
      where session_id=v_session_id and member_id=v_event.member_id;
      update public.session_events set rank_at_event=v_rank where id=v_event.id;
    else
      if not exists(select 1 from public.session_players where session_id=v_session_id and member_id=v_event.member_id and status='active') then
        raise exception 'Cannot undo event: later 7/2 event is inconsistent' using errcode='22023';
      end if;
      update public.session_events set rank_at_event=null where id=v_event.id;
    end if;
  end loop;

  select count(*) into v_active from public.session_players where session_id=v_session_id and status='active';
  if v_active=1 and v_last_event_type='elimination' then
    update public.session_players set final_rank=1,current_rank=1
    where session_id=v_session_id and status='active';
    with latest_eliminations as (
      select member_id, max(sequence_number) as last_out
      from public.session_events where session_id=v_session_id and event_type='elimination' group by member_id
    ), final_places as (
      select member_id, row_number() over(order by last_out desc) + 1 as final_rank from latest_eliminations
    )
    update public.session_players player
    set final_rank=places.final_rank, current_rank=places.final_rank
    from final_places places where player.session_id=v_session_id and player.member_id=places.member_id;
    update public.sessions set status='finished' where id=v_session_id;
  end if;

  perform set_config('app.undo_session_event', '', true);
end;
$$;
alter function public.undo_session_event(bigint) owner to postgres;
revoke all on function public.undo_session_event(bigint) from public, anon;
grant execute on function public.undo_session_event(bigint) to authenticated;

create or replace function public.guard_championship_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_season_id integer;
  v_status public.season_status;
  v_session_id text;
  v_session_status public.session_status;
  v_undo_session_id text := current_setting('app.undo_session_event', true);
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
      if v_session_status='finished' and tg_op='UPDATE' and old.status='finished'
         and not (new.status='open' and v_undo_session_id=v_session_id) then
        raise exception 'Session is read only' using errcode='55000';
      end if;
      if tg_op='UPDATE' and old.status='open' and new.status='open'
         and (new.played_at is distinct from old.played_at or new.configuration_snapshot is distinct from old.configuration_snapshot)
         and exists(select 1 from public.session_players where session_id=v_session_id) then
        raise exception 'Session metadata cannot change after participants are added' using errcode='55000';
      end if;
    else
      select status into v_session_status from public.sessions where id=v_session_id;
      if v_session_status='finished' and not (
        tg_table_name='session_events' and tg_op='DELETE' and v_undo_session_id=v_session_id
      ) then raise exception 'Session is read only' using errcode='55000'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
