-- Use one duration for all levels; each level contains only SB and BB.
alter table seasons
  add column if not exists blind_level_minutes integer not null default 20;

-- Preserve existing configurations: take duration from first level, strip
-- per-level duration and ante, keeping only level/SB/BB.
update seasons s
set blind_level_minutes = coalesce(
  (
    select nullif(level->>'minutes', '')::integer
    from jsonb_array_elements(
      case
        when jsonb_typeof(s.blind_structure) = 'array' then s.blind_structure
        else '[]'::jsonb
      end
    ) with ordinality as levels(level, ord)
    order by ord
    limit 1
  ),
  s.blind_level_minutes,
  20
),
blind_structure = coalesce(
  (
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'level', level->'level',
        'small', level->'small',
        'big', level->'big'
      )) order by ord
    )
    from jsonb_array_elements(
      case
        when jsonb_typeof(s.blind_structure) = 'array' then s.blind_structure
        else '[]'::jsonb
      end
    ) with ordinality as levels(level, ord)
  ),
  '[]'::jsonb
);
