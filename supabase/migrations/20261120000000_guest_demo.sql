-- Guest access to the clinician console: demo cases only, reset daily.
--
-- Demo check-ins are ordinary sessions flagged is_demo. The guest account (app_metadata.demo = true)
-- sees only these; real staff never see them. reset_demo_data() deletes every demo case and recreates
-- a fixed set; pg_cron runs it daily at 00:00 UTC (04:00 UAE), and the guest can run it from the console.
-- All demo content is invented: no real person, phone number or answer.

alter table sessions add column if not exists is_demo boolean not null default false;
create index if not exists sessions_is_demo_idx on sessions (is_demo) where is_demo;

-- One demo session with its consent, an empty summary (drafted from the data when opened) and a receipt.
create or replace function demo_session(
  p_path assessment_path, p_ago interval, p_method text, p_address text,
  p_age text, p_gender text, p_nationality text, p_language text, p_emirate text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  at timestamptz := now() - p_ago;
begin
  insert into sessions (
    path, is_demo, created_at, contact_method, contact_phone, contact_email, contact_times, contact_leave_message,
    demo_age_band, demo_gender, demo_nationality, demo_language_variety, demo_emirate
  ) values (
    p_path, true, at, p_method,
    case when p_method in ('phone', 'sms', 'whatsapp') then p_address end,
    case when p_method = 'email' then p_address end,
    case when p_method is not null then array['weekday_evenings'] end,
    case when p_method = 'phone' then true end,
    p_age, p_gender, p_nationality, p_language, p_emirate
  ) returning id into sid;

  insert into consent_records (session_id, purpose, granted, version, created_at) values
    (sid, 'clinician_review', true, 'demo', at),
    (sid, 'service_improvement', true, 'demo', at);
  if p_method is not null then
    insert into consent_records (session_id, purpose, granted, version, created_at)
    values (sid, ('contact_' || p_method)::consent_purpose, true, 'demo', at);
  end if;
  insert into summaries (session_id, draft, updated_at) values (sid, '{"lines": []}'::jsonb, at);
  insert into receipt_events (session_id, status, created_at) values (sid, 'received', at);
  return sid;
end $$;

create or replace function reset_demo_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  guest uuid := (select id from auth.users where email = 'guest@borderless.demo' limit 1);
  s uuid;
  f uuid;
  p uuid;
  n int := 0;
begin
  -- Clear: audit lines have no foreign key, adverse events only set null.
  delete from audit_events where session_id in (select id from sessions where is_demo);
  delete from adverse_events where session_id in (select id from sessions where is_demo);
  delete from sessions where is_demo;

  -- 1. Imminent: quick check, "yes" to the suicide question, then acute on the ASQ.
  s := demo_session('quick', interval '6 minutes', 'phone', '050 000 0101', '18-24', 'Female', 'Emirati', 'Arabic', 'Abu Dhabi');
  update sessions set taken_over = true, taken_over_at = now() - interval '5 minutes' where id = s;
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ2', 5, 'positive', 'demo', now() - interval '6 minutes'),
    (s, 'GAD2', 4, 'positive', 'demo', now() - interval '6 minutes');
  insert into red_flag_events (session_id, trigger, rule_id, tier, created_at)
    values (s, 'questionnaire answer', 'RF-QC-SUICIDE-YES', 'urgent', now() - interval '6 minutes');
  insert into red_flag_events (session_id, trigger, rule_id, tier, created_at)
    values (s, 'questionnaire answer', 'RF-ASQ-ACUTE', 'imminent', now() - interval '5 minutes') returning id into f;
  insert into tasks (session_id, type, priority, due_at, red_flag_event_id, created_at)
    values (s, 'red_flag', 'imminent', now() + interval '10 minutes', f, now() - interval '5 minutes');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, null, true, array['RF-QC-SUICIDE-YES', 'RF-ASQ-ACUTE'],
     array['Answered "yes" to the quick-check direct suicide question', '"Yes" to the ASQ acuity question (thoughts of killing yourself right now)'],
     'demo', now() - interval '5 minutes');
  n := n + 1;

  -- 2. Urgent: full check-in, PHQ-9 item 9 above zero.
  s := demo_session('full', interval '50 minutes', 'sms', '050 000 0102', '25-34', 'Male', 'South Asian', 'English', 'Dubai');
  update sessions set taken_over = true, taken_over_at = now() - interval '48 minutes' where id = s;
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ9', 16, 'moderately_severe', 'demo', now() - interval '50 minutes'),
    (s, 'GAD7', 12, 'moderate', 'demo', now() - interval '50 minutes');
  insert into red_flag_events (session_id, trigger, rule_id, tier, created_at)
    values (s, 'questionnaire answer', 'RF-PHQ9-ITEM9', 'urgent', now() - interval '48 minutes') returning id into f;
  insert into tasks (session_id, type, priority, due_at, red_flag_event_id, created_at)
    values (s, 'red_flag', 'urgent', now() + interval '3 hours 12 minutes', f, now() - interval '48 minutes');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, null, true, array['RF-PHQ9-ITEM9'], array['PHQ-9 item 9 (thoughts of being better off dead or of self-harm) above zero'], 'demo', now() - interval '48 minutes');
  n := n + 1;

  -- 3. Urgent: opened "I need help now", no contact details left.
  s := demo_session('crisis', interval '1 hour 30 minutes', null, null, null, null, null, null, null);
  update sessions set taken_over = true, taken_over_at = now() - interval '90 minutes' where id = s;
  insert into red_flag_events (session_id, trigger, rule_id, tier, created_at)
    values (s, 'crisis page', 'RF-HELP-NOW', 'urgent', now() - interval '90 minutes') returning id into f;
  insert into tasks (session_id, type, priority, due_at, red_flag_event_id, created_at)
    values (s, 'red_flag', 'urgent', now() + interval '2 hours 30 minutes', f, now() - interval '90 minutes');
  n := n + 1;

  -- 4. Elevated: full check-in in the high range.
  s := demo_session('full', interval '3 hours', 'whatsapp', '050 000 0104', '35-44', 'Female', 'Arab expatriate', 'Arabic', 'Sharjah');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ9', 13, 'moderate', 'demo', now() - interval '3 hours'),
    (s, 'GAD7', 16, 'severe', 'demo', now() - interval '3 hours');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 4, false, array['RT-FULL-HIGH'], array['PHQ-9 or GAD-7 at 15 or more'], 'demo', now() - interval '3 hours');
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'care_request', 'elevated', now() + interval '20 hours', now() - interval '3 hours');
  n := n + 1;

  -- 5. Routine: quick check with a positive mood gate.
  s := demo_session('quick', interval '2 hours', 'sms', '050 000 0105', '18-24', 'Male', 'Western', 'English', 'Abu Dhabi');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ2', 3, 'positive', 'demo', now() - interval '2 hours'),
    (s, 'GAD2', 2, 'negative', 'demo', now() - interval '2 hours');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 1, false, array['RT-QUICK-POSITIVE', 'RT-QUICK-CAP'],
     array['Quick check with a positive mood or worry gate (full check-in advised)', 'A quick check alone never proposes more than step 1'], 'demo', now() - interval '2 hours');
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'care_request', 'normal', now() + interval '22 hours', now() - interval '2 hours');
  n := n + 1;

  -- 6. Routine: full check-in, mild.
  s := demo_session('full', interval '5 hours', 'email', 'demo.person6@example.com', '45-54', 'Female', 'Western', 'English', 'Dubai');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ9', 7, 'mild', 'demo', now() - interval '5 hours'),
    (s, 'GAD7', 6, 'mild', 'demo', now() - interval '5 hours');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 1, false, array['RT-FULL-MILD'], array['PHQ-9 or GAD-7 in the mild range (5 or more)'], 'demo', now() - interval '5 hours');
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'care_request', 'normal', now() + interval '19 hours', now() - interval '5 hours');
  n := n + 1;

  -- 7. Routine, acknowledged, spoke with the person: moderate.
  s := demo_session('full', interval '1 day 2 hours', 'phone', '050 000 0107', '25-34', 'Female', 'South Asian', 'Hindi/Urdu', 'Abu Dhabi');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ9', 11, 'moderate', 'demo', now() - interval '26 hours'),
    (s, 'GAD7', 9, 'mild', 'demo', now() - interval '26 hours');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 3, false, array['RT-FULL-MODERATE'], array['PHQ-9 or GAD-7 in the moderate range (10 or more)'], 'demo', now() - interval '26 hours');
  insert into tasks (session_id, type, priority, due_at, acknowledged_at, acknowledged_by, created_at)
    values (s, 'care_request', 'normal', now() + interval '2 hours', now() - interval '20 hours', guest, now() - interval '26 hours');
  insert into receipt_events (session_id, status, created_at) values (s, 'reviewed', now() - interval '20 hours');
  if guest is not null then
    insert into contact_attempts (session_id, outcome, note, clinician_id, created_at)
      values (s, 'spoke', 'Demo: agreed to a follow-up call.', guest, now() - interval '19 hours');
  end if;
  n := n + 1;

  -- 8. Referred to SEHA primary care, waiting to book.
  s := demo_session('full', interval '2 days', 'sms', '050 000 0108', '35-44', 'Male', 'Emirati', 'Arabic', 'Al Ain');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ9', 9, 'mild', 'demo', now() - interval '2 days'),
    (s, 'GAD7', 10, 'moderate', 'demo', now() - interval '2 days');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 2, false, array['RT-PHYSICAL-CONDITION'], array['Mild or higher scores together with a physical health condition'], 'demo', now() - interval '2 days')
    returning id into p;
  update sessions set physical_conditions = array['diabetes'] where id = s;
  insert into consent_records (session_id, purpose, granted, version, created_at) values (s, 'physical_health', true, 'demo', now() - interval '2 days');
  if guest is not null then
    insert into clinician_decisions (proposal_id, action, clinician_id, created_at) values (p, 'accept', guest, now() - interval '44 hours');
    insert into contact_attempts (session_id, outcome, note, clinician_id, created_at)
      values (s, 'spoke', 'Demo: talked through the referral.', guest, now() - interval '43 hours');
  end if;
  insert into receipt_events (session_id, status, created_at) values
    (s, 'reviewed', now() - interval '44 hours'), (s, 'accepted', now() - interval '44 hours');
  insert into receipt_events (session_id, status, service_id, created_at) values (s, 'referred', 'seha-primary-care', now() - interval '43 hours');
  insert into referrals (session_id, service_id, referred_at) values (s, 'seha-primary-care', now() - interval '43 hours');
  n := n + 1;

  -- 9. Call-back request only.
  s := demo_session('contact', interval '40 minutes', 'phone', '050 000 0109', null, null, null, null, null);
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'talk_to_person', 'normal', now() + interval '23 hours', now() - interval '40 minutes');
  n := n + 1;

  -- 10. A message from the person, waiting for a reply.
  s := demo_session('quick', interval '1 day', 'sms', '050 000 0110', '55+', 'Male', 'Other', 'English', 'Abu Dhabi');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ2', 1, 'negative', 'demo', now() - interval '1 day'),
    (s, 'GAD2', 2, 'negative', 'demo', now() - interval '1 day');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 0, false, array['RT-QUICK-NEGATIVE'], array['Quick check with both gates negative'], 'demo', now() - interval '1 day');
  insert into patient_messages (session_id, body, from_patient, created_at)
    values (s, 'Is it OK if you call after 6pm? I can''t talk at work.', true, now() - interval '3 hours');
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'patient_message', 'normal', now() + interval '21 hours', now() - interval '3 hours');
  n := n + 1;

  -- 11. A coping card that isn't helping.
  s := demo_session('quick', interval '4 hours', 'whatsapp', '050 000 0111', '25-34', 'Another way', 'Western', 'English', 'Dubai');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ2', 2, 'negative', 'demo', now() - interval '4 hours'),
    (s, 'GAD2', 3, 'positive', 'demo', now() - interval '4 hours');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 1, false, array['RT-QUICK-POSITIVE', 'RT-QUICK-CAP'],
     array['Quick check with a positive mood or worry gate (full check-in advised)', 'A quick check alone never proposes more than step 1'], 'demo', now() - interval '4 hours');
  insert into tasks (session_id, type, priority, due_at, created_at)
    values (s, 'not_helping', 'normal', now() + interval '20 hours', now() - interval '1 hour');
  n := n + 1;

  -- 12. Closed: self-help plan agreed after a conversation.
  s := demo_session('quick', interval '3 days', 'phone', '050 000 0112', '45-54', 'Female', 'Arab expatriate', 'Arabic', 'Abu Dhabi');
  insert into scores (session_id, instrument, total, band, computed_by_rule, created_at) values
    (s, 'PHQ2', 1, 'negative', 'demo', now() - interval '3 days'),
    (s, 'GAD2', 1, 'negative', 'demo', now() - interval '3 days');
  insert into triage_proposals (session_id, step, urgent, rule_ids, reasons, ruleset_version, created_at) values
    (s, 0, false, array['RT-QUICK-NEGATIVE'], array['Quick check with both gates negative'], 'demo', now() - interval '3 days')
    returning id into p;
  if guest is not null then
    insert into clinician_decisions (proposal_id, action, clinician_id, created_at) values (p, 'accept', guest, now() - interval '70 hours');
    insert into contact_attempts (session_id, outcome, note, clinician_id, created_at)
      values (s, 'spoke', 'Demo: agreed a self-help plan.', guest, now() - interval '69 hours');
  end if;
  insert into receipt_events (session_id, status, created_at) values
    (s, 'reviewed', now() - interval '70 hours'), (s, 'accepted', now() - interval '70 hours'), (s, 'closed', now() - interval '68 hours');
  update summaries set signed_at = now() - interval '70 hours', signed_by = guest where session_id = s;
  update sessions set closed_at = now() - interval '68 hours', closure_reason = 'self_help_plan', closed_by = guest where id = s;
  n := n + 1;

  return n;
end $$;

revoke execute on function demo_session(assessment_path, interval, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function reset_demo_data() from public, anon, authenticated;

-- Daily at 00:00 UTC (04:00 UAE).
select cron.schedule('reset-demo-data', '0 0 * * *', $$select public.reset_demo_data()$$);
