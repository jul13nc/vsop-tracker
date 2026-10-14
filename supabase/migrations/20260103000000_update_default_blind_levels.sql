-- Update seasons still using the previous built-in blind defaults.
-- Custom structures are preserved.
update seasons
set blind_structure = '[
  {"level":1,"small":25,"big":50},
  {"level":2,"small":50,"big":100},
  {"level":3,"small":75,"big":150},
  {"level":4,"small":100,"big":200},
  {"level":5,"small":150,"big":300},
  {"level":6,"small":200,"big":400},
  {"level":7,"small":250,"big":500},
  {"level":8,"small":300,"big":600},
  {"level":9,"small":400,"big":800},
  {"level":10,"small":600,"big":1200},
  {"level":11,"small":1200,"big":2400},
  {"level":12,"small":2000,"big":4000},
  {"level":13,"small":3000,"big":6000},
  {"level":14,"small":4000,"big":8000}
]'::jsonb
where blind_structure in (
  '[
    {"level":1,"small":25,"big":50},
    {"level":2,"small":50,"big":100},
    {"level":3,"small":75,"big":150},
    {"level":4,"small":100,"big":200},
    {"level":5,"small":150,"big":300},
    {"level":6,"small":200,"big":400},
    {"level":7,"small":300,"big":600},
    {"level":8,"small":400,"big":800},
    {"level":9,"small":500,"big":1000},
    {"level":10,"small":700,"big":1400}
  ]'::jsonb,
  '[
    {"level":1,"small":25,"big":50},
    {"level":2,"small":50,"big":100},
    {"level":3,"small":75,"big":150},
    {"level":4,"small":100,"big":200},
    {"level":5,"small":150,"big":300},
    {"level":6,"small":200,"big":400}
  ]'::jsonb
);
