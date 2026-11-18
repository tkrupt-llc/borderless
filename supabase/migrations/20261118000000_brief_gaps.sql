-- Challenge-brief gaps: granular consent, physical health, referral status,
-- fairness by emirate, adverse events.

-- Granular, revocable consent: AI help, each contact channel, physical health.
alter type consent_purpose add value if not exists 'ai_help';
alter type consent_purpose add value if not exists 'contact_phone';
alter type consent_purpose add value if not exists 'contact_sms';
alter type consent_purpose add value if not exists 'contact_whatsapp';
alter type consent_purpose add value if not exists 'contact_email';
alter type consent_purpose add value if not exists 'physical_health';

-- Referral status on the receipt: referred -> booked -> first contact.
alter type receipt_status add value if not exists 'referred';

-- Physical health (optional, consented) and emirate (fairness breakdowns).
alter table sessions
  add column if not exists physical_conditions text[],
  add column if not exists physical_other text,
  add column if not exists demo_emirate text;

-- Adverse events reported by clinicians (counted on the service overview).
create table if not exists adverse_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions (id) on delete set null,
  category text not null check (category in ('self_harm', 'harm_to_others', 'missed_urgent_contact', 'care_delay', 'privacy', 'other')),
  severity text not null check (severity in ('low', 'moderate', 'severe')),
  description text not null check (char_length(description) between 5 and 2000),
  reported_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists adverse_events_created_idx on adverse_events (created_at);
alter table adverse_events enable row level security;
