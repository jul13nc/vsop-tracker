create or replace function public.read_public_standings(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_season_id uuid; v_result jsonb;
begin
  select season_id into v_season_id from public.public_standings_links
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null;
  if v_season_id is null then return null; end if;

  with first_rebuys as (
    select session_id, member_id, min(sequence_number) as first_sequence
    from public.session_events where event_type='rebuy'
    group by session_id, member_id
  ), ranked_results as (
    select
      session.id as session_id,
      player.member_id,
      member.name,
      session.played_at,
      player.final_rank,
      (rebuy.first_sequence is not null) as rebought,
      row_number() over (
        partition by session.id
        order by
          case when rebuy.first_sequence is null then 0 else 1 end,
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
    from ranked_results ranked
    cross join public.season_configurations configuration
    where configuration.season_id=v_season_id
  ), standings as (
    select name, sum(points) as total_points,
      jsonb_agg(jsonb_build_object(
        'session_date',played_at,
        'rank',annual_rank,
        'points',points,
        'rebought',rebought
      ) order by played_at) as sessions
    from earned_points
    group by name
  )
  select jsonb_build_object(
    'season', jsonb_build_object('start_year',season.start_year,'status',season.status),
    'standings',coalesce((
      select jsonb_agg(jsonb_build_object('name',name,'points',total_points,'sessions',sessions) order by total_points desc,name)
      from standings
    ),'[]'::jsonb),
    'seven_two_standings',coalesce((
      select jsonb_agg(jsonb_build_object('name',seven_two.name,'wins',seven_two.wins) order by seven_two.wins desc,seven_two.name)
      from (
        select member.id,member.name,count(*) as wins
        from public.session_events event
        join ranked_results ranked on ranked.session_id=event.session_id and ranked.member_id=event.member_id
        join public.members member on member.id=event.member_id
        where event.event_type='seven_two'
        group by member.id,member.name
      ) seven_two
    ),'[]'::jsonb),
    'session_results',coalesce((
      select jsonb_agg(jsonb_build_object(
        'played_at',game.played_at,
        'payout_table',game.configuration_snapshot->'payout_table',
        'buy_in',game.configuration_snapshot->'buy_in',
        'pot',coalesce((
          select sum(entry.amount)
          from (
            select (game.configuration_snapshot->>'buy_in')::numeric as amount
            from public.session_players initial_player where initial_player.session_id=game.id
            union all
            select rebuy.amount from public.session_events rebuy where rebuy.session_id=game.id and rebuy.event_type='rebuy'
          ) entry
        ),0),
        'players',coalesce((
          select jsonb_agg(jsonb_build_object(
            'name',member.name,
            'rank',player.final_rank,
            'rebought',exists(
              select 1 from public.session_events event
              where event.session_id=game.id and event.member_id=player.member_id and event.event_type='rebuy'
            )
          ) order by player.final_rank)
          from public.session_players player
          join public.members member on member.id=player.member_id
          where player.session_id=game.id
        ),'[]'::jsonb)
      ) order by game.played_at desc)
      from public.sessions game where game.season_id=v_season_id and game.status='finished'
    ),'[]'::jsonb)
  ) into v_result
  from public.seasons season where season.id=v_season_id;
  return v_result;
end;
$$;
alter function public.read_public_standings(text) owner to postgres;
