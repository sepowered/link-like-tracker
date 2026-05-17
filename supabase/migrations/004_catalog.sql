-- 플레이리스트 카탈로그 (시즌 / 비디오)
-- videoId는 YouTube ID를 그대로 사용 → localStorage 진행상태와 1:1 매핑 보장

create table if not exists seasons (
  id text primary key,        -- 예: "103-main"
  name text not null,
  sort_order integer not null
);

create table if not exists videos (
  id text primary key,        -- YouTube ID: "mfp3-WvWbck"
  season_id text not null references seasons(id) on delete cascade,
  title text not null,
  url text not null,
  sort_order integer not null,
  category_override text check (
    category_override in ('story', 'music', 'fesxlive', 'withxmeets', 'fesxrec')
    or category_override is null
  )
);

alter table seasons enable row level security;
alter table videos enable row level security;

-- 카탈로그는 공개 읽기 (비인증 포함)
create policy "public read seasons" on seasons for select using (true);
create policy "public read videos"  on videos  for select using (true);
-- UPDATE/INSERT는 service_role(Dashboard)만 허용 — 별도 정책 없음
