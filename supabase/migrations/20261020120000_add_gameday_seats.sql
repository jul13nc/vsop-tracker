-- Placement aléatoire des participants : table et siège attribués à la création.

alter table gameday_players
  add column table_number int,
  add column seat_number  int;

create index if not exists gameday_players_seat_idx
  on gameday_players(gameday_id, table_number, seat_number);
