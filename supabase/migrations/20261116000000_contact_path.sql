-- "Talk to a person" can be used without starting a check-in. Such a session
-- has no questionnaire path, so it gets its own value instead of a wrong one.
alter type assessment_path add value if not exists 'contact';
