begin;
select plan(56);

select has_table('public', 'seasons', 'seasons table exists');
select has_table('public', 'season_configurations', 'configuration table exists');
select has_table('public', 'members', 'members table exists');
select has_table('public', 'sessions', 'sessions table exists');
select has_table('public', 'session_players', 'session players table exists');
select has_table('public', 'session_events', 'session events table exists');
select ok((select relrowsecurity from pg_class where oid='public.seasons'::regclass), 'seasons enable row-level security');
select ok((select relrowsecurity from pg_class where oid='public.session_events'::regclass), 'events enable row-level security');

insert into auth.users(id, email, encrypted_password, aud, role, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111','host@example.test','', 'authenticated','authenticated',now(),now());
reset role;
alter table public.profiles disable row level security;
update public.profiles set role='organizer' where user_id='11111111-1111-4111-8111-111111111111';
alter table public.profiles enable row level security;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok($$select public.create_season(2026)$$, 'organizer creates season');
select lives_ok($$select public.create_public_standings_link((select id from public.seasons limit 1))$$, 'organizer creates public standings token');
select ok(public.read_public_standings((select public.create_public_standings_link((select id from public.seasons limit 1)))) ? 'standings', 'public token returns aggregated standings only');
select is(public.read_public_standings('invalid-token'),null,'invalid public token returns no standings');

select throws_ok($$select public.create_season(2026)$$,'23505',null,'duplicate school year rejected');
select is((select buy_in from public.season_configurations limit 1),10::numeric,'default buy-in is ten euros');
select ok((select count(*)=3 from jsonb_array_elements((select chips from public.season_configurations limit 1))), 'default chip set has three denominations');
select is((select payout_table->'140'->>'1' from public.season_configurations limit 1),'90','default 140 euro payout gives ninety euros to first place');
select throws_ok($$update public.season_configurations set payout_table='{"70":{"1":40,"2":20}}'::jsonb where season_id=(select id from public.seasons limit 1)$$,'22023','Payout values must add up to pot','invalid payout rejected by database');
select throws_ok($$update public.season_configurations set chips='[{"label":"Green","value":0,"quantity":12}]'::jsonb where season_id=(select id from public.seasons limit 1)$$,'22023','Each chip needs label, positive value and quantity','invalid chip rejected by database');
select lives_ok($$select public.invite_reader('reader@example.test')$$,'organizer adds reader invitation before account signup');
select throws_ok($$select public.invite_reader('reader@example.test')$$,'23505','An invitation for this email is already pending','duplicate pending invitation is rejected');
select lives_ok($$insert into public.members(name) values('Ada'),('Benoit'),('Chloe')$$,'organizer creates members');
select lives_ok($$select public.create_session((select id from public.seasons limit 1),'2026-10-01',(select array_agg(id) from public.members))$$,'organizer creates session and selects participants');
select throws_ok($$select public.close_season((select id from public.seasons limit 1))$$,'55000','Finish all sessions before closing season','cannot close season with open session');
select is((select count(*)::integer from public.session_players),3,'selected participants are attached to session');
select lives_ok($$select public.record_session_event((select id from public.sessions limit 1),(select member_id from public.session_players order by member_id limit 1),'elimination')$$,'organizer records elimination');
select is((select event_type::text from public.session_events order by sequence_number limit 1),'elimination','event is stored in session order');
select lives_ok($$select public.record_session_event((select id from public.sessions limit 1),(select member_id from public.session_players order by member_id limit 1),'rebuy')$$,'eliminated player can rebuy');
select is((select first_rebuy_rank from public.session_players where member_id=(select member_id from public.session_events where event_type='rebuy' limit 1)),3,'first rebuy rank is frozen');
select lives_ok($$select public.record_session_event((select id from public.sessions limit 1),(select member_id from public.session_players order by member_id limit 1),'seven_two')$$,'organizer records seven-two hand');
select is((select amount from public.session_events where event_type='seven_two'),0::numeric,'seven-two has no contribution to pot');
select lives_ok($$select public.record_session_event((select id from public.sessions limit 1),(select member_id from public.session_players where status='active' and member_id<>(select member_id from public.session_events where event_type='rebuy' limit 1) order by member_id limit 1),'elimination')$$,'organizer records second elimination');
select lives_ok($$select public.record_session_event((select id from public.sessions limit 1),(select member_id from public.session_events where event_type='rebuy' limit 1),'elimination')$$,'last elimination finishes session');
select throws_ok($$update public.session_players set status='active' where session_id=(select id from public.sessions limit 1)$$,'55000','Session is read only','finished session cannot be changed');
select throws_ok($$update public.sessions set played_at='2026-10-02' where id=(select id from public.sessions limit 1)$$,'55000','Session is read only','finished session metadata cannot be changed');
select is((select status::text from public.sessions limit 1),'finished','last active player finishes session');
select is((select final_rank from public.session_players where member_id=(select member_id from public.session_events where event_type='rebuy' limit 1)),2,'rebought player can finish above their first rebuy rank');
select is((select first_rebuy_rank from public.session_players where member_id=(select member_id from public.session_events where event_type='rebuy' limit 1)),3,'later elimination does not overwrite first rebuy rank');
select is((select count(distinct final_rank)::integer from public.session_players),3,'final ranks remain unique after rebuy');
select is((select count(*)::integer from public.session_events),5,'all events preserve their history');
select ok((public.read_public_standings((select public.create_public_standings_link((select id from public.seasons limit 1)))) ? 'seven_two_standings'),'public standings aggregate includes 7/2 leaderboard');
select is(jsonb_array_length(public.read_public_standings((select public.create_public_standings_link((select id from public.seasons limit 1))))->'session_results'),1,'public standings include finished session results');
select is(jsonb_array_length(public.read_public_standings((select public.create_public_standings_link((select id from public.seasons limit 1))))->'session_results'->0->'players'),3,'public day results include finish places');
select is((public.read_public_standings((select public.create_public_standings_link((select id from public.seasons limit 1))))->'session_results'->0) ? 'events',false,'public day result omits event history');
select lives_ok($$update public.season_configurations set buy_in=12 where season_id=(select id from public.seasons limit 1)$$,'season configuration can evolve for future sessions');
select is((select configuration_snapshot->>'buy_in' from public.sessions limit 1),'10.00','session retains original config snapshot');
select lives_ok($$select public.close_season((select id from public.seasons limit 1))$$,'organizer closes season after finishing session');
select lives_ok($$insert into public.members(name) values('Archived newcomer')$$,'organizer can add members for future seasons');
select throws_ok($$select public.create_session((select id from public.seasons limit 1),'2026-11-01',(select array_agg(id) from public.members))$$,'22023','Open season required','closed season rejects future session');
select throws_ok($$insert into public.season_configurations(season_id) values((select id from public.seasons limit 1))$$,'55000','Season is read only','closed season rejects configuration changes');
select throws_ok($$update public.seasons set status='open' where id=(select id from public.seasons limit 1)$$,'55000','Season is read only','closed season cannot reopen through database API');
reset role;
insert into auth.users(id,email,encrypted_password,aud,role,created_at,updated_at)
values('22222222-2222-4222-8222-222222222222','reader@example.test','', 'authenticated','authenticated',now(),now());
select lives_ok($$select public.invite_reader('reader@example.test')$$,'organizer can resend reader invitation without changing reader role');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$update public.profiles set role='organizer' where user_id='22222222-2222-4222-8222-222222222222'$$,'42501',null,'reader cannot elevate own role');
select ok((select count(*)=1 from public.seasons),'invited reader can read seasons');
select is((select count(*)::integer from public.reader_invitations),0,'reader cannot enumerate invitation addresses');
select throws_ok($$insert into public.members(name) values('Unauthorized')$$,'42501',null,'reader cannot write members');

reset role;
insert into auth.users(id,email,encrypted_password,aud,role,created_at,updated_at)
values('33333333-3333-4333-8333-333333333333','stranger@example.test','', 'authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.seasons),0,'uninvited account cannot read seasons');

select * from finish();
rollback;
