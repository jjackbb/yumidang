-- Keep signup profile minimal: activity or meetup location belongs to a later feature contract.
alter table public.profiles
  drop constraint if exists profiles_neighborhood_trimmed,
  drop constraint if exists profiles_neighborhood_length,
  drop column if exists neighborhood;
