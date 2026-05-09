-- 기기별 영상 진행상태
create table if not exists user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  video_id text not null,
  status text not null check (status in ('watched', 'unwatched')),
  category_override text null check (
    category_override in ('story', 'music', 'fesxlive', 'fesxrec', 'withxmeets')
    or category_override is null
  ),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, video_id)
);

alter table user_progress enable row level security;

create policy "users own their progress"
  on user_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 기기 레지스트리
create table if not exists user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table user_devices enable row level security;

create policy "users own their devices"
  on user_devices for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
