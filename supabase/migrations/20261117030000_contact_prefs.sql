-- How the person wants to be contacted (design canvas: "How should we contact you").
-- Contact details stay null until the person chooses to share them.
alter table sessions
  add column if not exists contact_method text check (contact_method in ('phone', 'sms', 'whatsapp', 'email')),
  add column if not exists contact_email text,
  add column if not exists contact_times text[],
  add column if not exists contact_leave_message boolean;
