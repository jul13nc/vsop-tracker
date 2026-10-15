alter table seasons
  add column rebuy_timeout_minutes int not null default 90;
