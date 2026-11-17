-- "Reply to patient" from the clinician console: a short message the person
-- sees on their receipt timeline. Deleted with the case.
create table if not exists patient_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  sent_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists patient_messages_session_idx on patient_messages (session_id, created_at);
alter table patient_messages enable row level security;
