"""Run migrations and write-operation tests in an isolated local Postgres DB.

Usage: python3 supabase/tests/run_web_operations.py
Requires the project's local Supabase Postgres container; never resets app data.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_vsop-tracker"
DATABASE = "vsop_test_" + uuid.uuid4().hex


def sql(source):
    return subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres",
         "-d", DATABASE, "-v", "ON_ERROR_STOP=1", "-At"],
        input=source, text=True, capture_output=True, check=True,
    ).stdout


subprocess.run(["docker", "exec", CONTAINER, "createdb", "-U", "postgres", DATABASE], check=True)
try:
    sql("create publication supabase_realtime;")
    for migration in sorted((ROOT / "migrations").glob("*.sql")):
        sql("begin;\n" + migration.read_text() + "\ncommit;")
    # Supabase initializes these grants in postgres, not in fresh createdb DBs.
    sql("grant usage on schema public to anon, authenticated;"
        "grant select on all tables in schema public to anon;"
        "grant all on all tables in schema public to authenticated;"
        "grant usage, select on all sequences in schema public to authenticated;")
    sql((ROOT / "tests" / "web_operations.sql").read_text())
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _: sql(
            "set role authenticated; select public.append_game_event('parallel', 'seven_two', 'alice');"
        ), range(20)))
    sql("do $$ begin assert (select count(*) = 20 and count(distinct seq) = 20 "
        "and min(seq) = 1 and max(seq) = 20 from public.game_events "
        "where gameday_id = 'parallel'), 'Concurrent appends must have unique contiguous sequences'; end; $$;")
    print("PASS: migrations, permissions, undo, atomic validation, stale journal, closed season, 20 concurrent appends")
except subprocess.CalledProcessError as error:
    print(error.stderr or error)
    raise
finally:
    subprocess.run(["docker", "exec", CONTAINER, "dropdb", "-U", "postgres", DATABASE], check=True)
