-- Who asked for a supervisor review (an override or a closure request), so the
-- co-sign must come from a different person.
alter table tasks add column if not exists requested_by uuid references auth.users (id);
