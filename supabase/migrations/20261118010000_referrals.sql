-- Referral follow-through: one row per hand-off to a service, moving
-- referred -> booked (with date) -> first contact -> closed. The follow-up
-- rules (content/rules/referral-followup.json) write the *_at columns once each.
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  service_id text not null,
  urgent boolean not null default false,
  status text not null default 'referred' check (status in ('referred', 'booked', 'first_contact', 'closed')),
  booked_for date,
  referred_at timestamptz not null default now(),
  booked_at timestamptz,
  first_contact_at timestamptz,
  closed_at timestamptz,
  reminder_at timestamptz,
  help_requested_at timestamptz,
  stalled_at timestamptz,
  attendance_asked_at timestamptz,
  urgent_requeued_at timestamptz,
  last_patient_answer text,
  is_simulated boolean not null default false
);
create index if not exists referrals_session_idx on referrals (session_id);
create index if not exists referrals_open_idx on referrals (status) where status <> 'closed';
alter table referrals enable row level security;

alter type task_type add value if not exists 'handoff_stalled';
alter type task_type add value if not exists 'handoff_check';
alter type receipt_status add value if not exists 'closed';
