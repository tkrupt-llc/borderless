-- "Talk to someone": a person can write to their care team (design canvas 2c).
-- Messages from the patient sit beside replies from the team; a new task type
-- puts them in the review queue.
alter type task_type add value if not exists 'patient_message';
alter table patient_messages add column if not exists from_patient boolean not null default false;
