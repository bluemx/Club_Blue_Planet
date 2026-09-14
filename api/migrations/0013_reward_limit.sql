-- How many times each child may redeem a reward. NULL = no limit, which is
-- what every reward so far (and the shared catalog) keeps.
alter table "reward" add column "maxPerChild" integer;
