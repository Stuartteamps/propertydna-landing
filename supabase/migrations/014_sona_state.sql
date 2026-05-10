-- Sona deployment agent state — single-row table for workflow handshake
create table if not exists sona_state (
  id           integer primary key default 1,
  phase        text not null default 'idle',
  code         text,
  confirm      text,
  message      text,
  updated_at   timestamptz default now(),
  constraint sona_state_singleton check (id = 1)
);

insert into sona_state (id, phase) values (1, 'idle')
on conflict (id) do nothing;
