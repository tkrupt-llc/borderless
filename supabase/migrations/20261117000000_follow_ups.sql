-- Follow-up check-ins. Each follow-up is its own session (so the safety rules,
-- red flags, queue and receipt work exactly as for a first check-in), linked to
-- the first check-in. The first check-in holds a random token: the private
-- follow-up link the person saves, since there is no account.
alter type assessment_path add value if not exists 'followup';

alter table sessions
  add column if not exists parent_session_id uuid references sessions (id) on delete cascade,
  add column if not exists follow_up_token text unique;

create index if not exists sessions_parent_session_id_idx on sessions (parent_session_id);
