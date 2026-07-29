-- The first sync deployment served the standalone Day Skipper app only.
-- keep club uses the same capability-key transport for each built-in course.
insert into sync.apps (app) values
  ('day-skipper'),
  ('competent-crew')
on conflict do nothing;
