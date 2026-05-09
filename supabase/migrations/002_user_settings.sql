-- 계정별 보기 설정
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_categories text[] not null default '{}',
  hide_private_videos boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint user_settings_progress_categories_valid check (
    progress_categories <@ array['story', 'music', 'fesxlive', 'fesxrec', 'withxmeets']::text[]
  )
);

alter table user_settings enable row level security;

create policy "users own their settings"
  on user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
