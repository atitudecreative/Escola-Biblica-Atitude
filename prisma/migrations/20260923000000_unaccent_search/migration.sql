-- Busca sem acentos (ex.: "biblia" encontra "Bíblia").
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE; este wrapper permite uso em índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS courses_title_search_idx ON courses USING gin (f_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lessons_title_search_idx ON lessons USING gin (f_unaccent(lower(title)) gin_trgm_ops);
