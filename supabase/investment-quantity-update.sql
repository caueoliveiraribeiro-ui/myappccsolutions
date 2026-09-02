-- Keeps the original purchase quantity intact for monthly history while allowing
-- users to reduce or increase the amount they currently hold.
alter table public.holdings
  add column if not exists remaining_quantity numeric;

update public.holdings
set remaining_quantity = quantity
where remaining_quantity is null;

