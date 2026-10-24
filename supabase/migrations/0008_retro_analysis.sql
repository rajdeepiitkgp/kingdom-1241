-- Kingdom 1241 — battle feedback: English translations and the AI summary
--
--   * kvk_retro_responses.texts_en   the three texts translated to English once
--                                    ({"went_well": "...", ...}; identical to the
--                                    original when it was English already),
--                                    written by the "Translate and analyse"
--                                    button; translated_at says when.
--   * kvk_retrospectives.analysis    the stored AI summary (mood, sentiment per
--                                    prompt, themes with a quote, suggested
--                                    actions, model and token usage), with the
--                                    moment and the number of responses it saw,
--                                    so the page shows it until someone re-runs.
--   Additive: the previous deploy ignores the columns.

alter table public.kvk_retro_responses add column if not exists texts_en jsonb;
alter table public.kvk_retro_responses add column if not exists translated_at timestamptz;

alter table public.kvk_retrospectives add column if not exists analysis jsonb;
alter table public.kvk_retrospectives add column if not exists analysis_at timestamptz;
alter table public.kvk_retrospectives add column if not exists analysis_count integer;
