-- Allow authenticated admins to delete gamedays, including in closed seasons.
-- Cascade deletes remove associated players, events, and clock rows.
drop policy if exists "auth delete gamedays" on gamedays;
create policy "auth delete gamedays"
  on gamedays for delete to authenticated using (true);

-- BEFORE DELETE triggers must return OLD; returning NEW (NULL for DELETE)
-- silently cancels the deletion and cascading cleanup.
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
