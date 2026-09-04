-- Orbit Support Inbox
-- Run this file once in Supabase SQL Editor before enabling persistent tickets.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.app_users(id) on delete set null,
  status text not null default 'open' check (status in ('open','pending','resolved')),
  subject text not null default 'Orbit Support',
  human_requested boolean not null default false,
  ai_enabled boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('user','orbit_ai','support_agent','system')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_user_id_idx
  on public.support_conversations(user_id, last_message_at desc);

create index if not exists support_conversations_status_idx
  on public.support_conversations(status, last_message_at desc);

create index if not exists support_messages_conversation_idx
  on public.support_messages(conversation_id, created_at asc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.support_conversations from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

grant select, insert, update, delete on public.support_conversations to service_role;
grant select, insert, update, delete on public.support_messages to service_role;

comment on table public.support_conversations is 'Orbit first-party support conversations. Accessed only through server-side APIs.';
comment on table public.support_messages is 'Messages belonging to Orbit support conversations.';
