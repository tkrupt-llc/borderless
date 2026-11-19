-- Contact gaps: a low-priority "Send reminder" task when a hand-off reminder
-- or "Did you see them?" fires, so staff send it themselves and log it.
alter type task_type add value if not exists 'send_reminder';
