-- =============================================================================
-- Seed data — product_mappings (style name -> supplier style code)
-- Run AFTER 0001_init.sql. Idempotent via ON CONFLICT (style_name).
-- default_hair_type is 'human hair' for all (this is the human-hair range).
-- Note: some supplier codes intentionally repeat across styles (e.g. N157,
-- SP113, N335) — style_name is the unique key.
-- =============================================================================
insert into product_mappings (style_name, supplier_style_code, default_hair_type) values
  ('ANEESHA',   'N95',    'human hair'),
  ('LILLIAN',   'N99',    'human hair'),
  ('BELLE',     'T9/613', 'human hair'),
  ('LOUISE',    'N157',   'human hair'),
  ('FIFI',      'SP125',  'human hair'),
  ('LUCIA',     'SP22',   'human hair'),
  ('CARTER',    'N263',   'human hair'),
  ('WINNY',     'N248',   'human hair'),
  ('PAYTON',    'N231-1', 'human hair'),
  ('ARIA',      'SP79',   'human hair'),
  ('MIXED ROOT','SP113',  'human hair'),
  ('AVALON',    'S6',     'human hair'),
  ('BIA',       'N335',   'human hair'),
  ('YOLANDA',   'N63',    'human hair'),
  ('LISA',      'N160',   'human hair'),
  ('DOVE',      'N309',   'human hair'),
  ('KYLE',      'N142',   'human hair'),
  ('TEDDY',     'N157',   'human hair'),
  ('BETH',      'SP107',  'human hair'),
  ('GEMIMA',    'N274',   'human hair'),
  ('LORIELI',   'N252',   'human hair'),
  ('JAHLA',     'SP113',  'human hair'),
  ('ELLA',      'N335',   'human hair'),
  ('VANESSA',   'N42',    'human hair'),
  ('LUNA',      'N307',   'human hair'),
  ('BRITTANY',  'N324',   'human hair')
on conflict (style_name) do update
  set supplier_style_code = excluded.supplier_style_code;
