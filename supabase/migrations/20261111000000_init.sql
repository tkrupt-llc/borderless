-- Initial schema for the intake, triage and follow-up prototype.
--
-- Access model: patient pages never talk to Supabase directly. Every write goes
-- through Next.js API routes using the service-role key (which bypasses RLS).
-- RLS is enabled on every table as a second line of defence: staff (clinician,
-- supervisor, judge) can read through their own session; anonymous users get
-- nothing.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type assessment_path as enum ('quick', 'full', 'crisis');
create type consent_purpose as enum ('clinician_review', 'follow_up', 'gp_sharing', 'service_improvement');
create type message_role as enum ('patient', 'assistant', 'system');
create type risk_tier as enum ('imminent', 'urgent', 'elevated');
create type task_type as enum ('red_flag', 'talk_to_person', 'callback', 'care_request', 'not_helping', 'not_on_track');
create type task_priority as enum ('imminent', 'urgent', 'elevated', 'normal');
create type decision_action as enum ('accept', 'override');
create type receipt_status as enum (
  'received', 'reviewed', 'accepted', 're_routed', 'booked',
  'first_contact_confirmed', 'contact_attempted', 'spoke'
);
create type contact_outcome as enum ('called_no_answer', 'spoke');

-- ---------------------------------------------------------------------------
-- Patient side
-- ---------------------------------------------------------------------------

create table sessions (
  id uuid primary key default gen_random_uuid(),
  path assessment_path not null,
  language text not null default 'en',
  discreet_mode boolean not null default false,
  -- Set once any red flag fires; the AI is never called again for this session.
  taken_over boolean not null default false,
  taken_over_at timestamptz,
  -- Contact details stay null until the person chooses a human hand-off.
  contact_phone text,
  preferred_language text,
  preferred_clinician_gender text,
  callback_time text,
  -- BPD/ADHD history: only self-reported or added by a clinician, never inferred.
  history_bpd boolean not null default false,
  history_adhd boolean not null default false,
  history_source text check (history_source in ('self_reported', 'clinician')),
  check_ins_paused boolean not null default false,
  -- Optional, synthetic in the demo: used only for the fairness breakdowns.
  demo_gender text,
  demo_age_band text,
  demo_nationality text,
  demo_language_variety text,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  purpose consent_purpose not null,
  granted boolean not null,
  version text not null,
  created_at timestamptz not null default now()
);
create index on consent_records (session_id, purpose, created_at desc);

-- Append-only: a change of mind is a new row, never an edit.
create function forbid_update() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
create trigger consent_records_append_only
  before update on consent_records
  for each row execute function forbid_update();

create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  role message_role not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index on messages (session_id, created_at);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  instrument text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on check_ins (session_id, due_at);

create table item_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  check_in_id uuid references check_ins (id) on delete cascade,
  instrument text not null,
  item_no int not null,
  item_id text not null,
  value int not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (session_id, check_in_id, instrument, item_no)
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  check_in_id uuid references check_ins (id) on delete cascade,
  instrument text not null,
  total int not null,
  band text not null,
  computed_by_rule text not null,
  created_at timestamptz not null default now()
);
create index on scores (session_id, instrument, created_at);

-- Every extracted field must cite the patient message it came from.
create table extracted_fields (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  field text not null,
  value text not null,
  source_message_id uuid not null references messages (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on extracted_fields (session_id, field);

create table red_flag_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  trigger text not null,
  rule_id text not null,
  message_id uuid references messages (id) on delete set null,
  tier risk_tier not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triage and clinician side
-- ---------------------------------------------------------------------------

create table triage_proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  step int check (step between 0 and 4),
  urgent boolean not null default false,
  rule_ids text[] not null,
  reasons text[] not null,
  ruleset_version text not null,
  created_at timestamptz not null default now(),
  check (step is not null or urgent)
);

create table clinician_decisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references triage_proposals (id) on delete cascade,
  action decision_action not null,
  new_step int check (new_step between 0 and 4),
  reason text,
  clinician_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- An override needs both a new step and a reason.
  check (action = 'accept' or (new_step is not null and length(trim(reason)) > 0))
);

create table summaries (
  session_id uuid primary key references sessions (id) on delete cascade,
  draft jsonb not null,
  edited jsonb,
  review_started_at timestamptz,
  signed_at timestamptz,
  signed_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  type task_type not null,
  priority task_priority not null,
  due_at timestamptz not null,
  red_flag_event_id uuid references red_flag_events (id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users (id),
  -- Set to due_at (the moment the clock ran out), not the time the job noticed.
  escalated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on tasks (priority, due_at) where closed_at is null;

create table receipt_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  status receipt_status not null,
  reason text,
  service_id text,
  typical_wait_days int,
  created_at timestamptz not null default now()
);
create index on receipt_events (session_id, created_at);

create table contact_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  outcome contact_outcome not null,
  note text,
  clinician_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- No foreign key on session_id: deleting a person's data leaves an anonymous
-- audit stub behind.
create table audit_events (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  object_type text not null,
  object_id text,
  session_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_events (session_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Staff role lives in app_metadata, which only the service role can set.
create function staff_role() returns text
  language sql stable
  set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'sessions', 'consent_records', 'messages', 'check_ins', 'item_responses',
    'scores', 'extracted_fields', 'red_flag_events', 'triage_proposals',
    'clinician_decisions', 'summaries', 'tasks', 'receipt_events',
    'contact_attempts', 'audit_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy staff_read on %I for select to authenticated
         using (public.staff_role() in (''clinician'', ''supervisor'', ''judge''))',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic safety operations (called from API routes with supabase.rpc)
-- ---------------------------------------------------------------------------

-- A red flag must never leave a half-written state: the takeover, the event,
-- the urgent task and the audit entry are written together or not at all.
create function raise_red_flag(
  p_session_id uuid,
  p_trigger text,
  p_rule_id text,
  p_tier risk_tier,
  p_due_at timestamptz,
  p_message_id uuid default null
) returns uuid
  language plpgsql
  set search_path = public
as $$
declare
  v_event_id uuid;
  v_task_id uuid;
begin
  update sessions
     set taken_over = true,
         taken_over_at = coalesce(taken_over_at, now())
   where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  insert into red_flag_events (session_id, trigger, rule_id, message_id, tier)
  values (p_session_id, p_trigger, p_rule_id, p_message_id, p_tier)
  returning id into v_event_id;

  insert into tasks (session_id, type, priority, due_at, red_flag_event_id)
  values (p_session_id, 'red_flag', p_tier::text::task_priority, p_due_at, v_event_id)
  returning id into v_task_id;

  insert into audit_events (actor, action, object_type, object_id, session_id, metadata)
  values ('system', 'red_flag_raised', 'task', v_task_id::text, p_session_id,
          jsonb_build_object('rule_id', p_rule_id, 'tier', p_tier, 'trigger', p_trigger));

  return v_task_id;
end;
$$;

-- Runs every minute via pg_cron. Overdue, unacknowledged tasks are escalated
-- to the duty supervisor, and each miss is logged as a safety event.
create function escalate_overdue_tasks() returns int
  language plpgsql
  set search_path = public
as $$
declare
  v_count int;
begin
  with escalated as (
    update tasks
       set escalated_at = due_at
     where acknowledged_at is null
       and escalated_at is null
       and closed_at is null
       and due_at <= now()
    returning id, session_id, priority, due_at
  )
  insert into audit_events (actor, action, object_type, object_id, session_id, metadata)
  select 'system', 'task_escalated', 'task', id::text, session_id,
         jsonb_build_object('priority', priority, 'due_at', due_at, 'safety_event', true)
    from escalated;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only the server (service role) may call these.
revoke execute on function raise_red_flag(uuid, text, text, risk_tier, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function escalate_overdue_tasks() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('escalate-overdue-tasks', '* * * * *', $$select public.escalate_overdue_tasks()$$);
