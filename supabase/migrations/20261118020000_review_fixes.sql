-- Doc-review fixes: supervisor triggers, case closure with scheduled
-- check-ins, and a return path with a reference and short code.

alter type task_type add value if not exists 'supervisor_review';
alter type task_type add value if not exists 'post_crisis_checkin';

-- Why a task exists, when a rule created it (e.g. the supervisor trigger that fired).
alter table tasks add column if not exists reason text;

-- Case closure (reason required) and the return path.
alter table sessions
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text check (closure_reason in ('handed_off', 'self_help_plan', 'declined', 'unreachable', 'data_deleted')),
  add column if not exists closed_by uuid references auth.users (id),
  add column if not exists return_code_hash text,
  add column if not exists return_failed_attempts int not null default 0,
  add column if not exists return_locked_until timestamptz;
