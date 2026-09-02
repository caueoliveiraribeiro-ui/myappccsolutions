alter table grocery_items add column if not exists subcategory text default '';
alter table expenses add column if not exists subcategory text default '';
alter table tasks add column if not exists kind text default 'Task';
alter table tasks add column if not exists notes text default '';

