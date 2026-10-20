-- Allow removing mistaken gamedays, including from closed seasons. Cascading
-- deletes clean up their players, events, and clock; season_standings is a view
-- and therefore recalculates automatically from the remaining rows.
create or replace function assert_season_open() returns trigger as $$
declare
  closed boolean;
  sid text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'gamedays' then
    sid := new.season_id;
  else
    select season_id into sid from gamedays where id = new.gameday_id;
  end if;

  select is_closed into closed from seasons where id = sid;
  if closed then
    raise exception 'Season % is closed; writes are not allowed.', sid;
  end if;
  return new;
end;
$$ language plpgsql;
