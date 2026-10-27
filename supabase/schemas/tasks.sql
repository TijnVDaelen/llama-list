begin;
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  notes text not null default '' check (char_length(notes) <= 3000),
  category text not null default 'Personal' check (category in ('Personal','Work','Wellness')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_created_idx on public.tasks(user_id, created_at desc);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
create policy "Users read own tasks" on public.tasks for select to authenticated using ((select auth.uid())=user_id);
create policy "Users create own tasks" on public.tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users update own tasks" on public.tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users delete own tasks" on public.tasks for delete to authenticated using ((select auth.uid())=user_id);
commit;
