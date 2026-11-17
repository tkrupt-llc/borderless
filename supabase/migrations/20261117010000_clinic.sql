-- Which clinic's website a check-in started from (embedded check-in). Null for
-- people who came to Borderless directly.
alter table sessions add column if not exists clinic_id text;
