-- 005_catalog_v2.sql — v2 카탈로그 스키마 (시즌 / 에피소드 / 콘텐츠 / 소스)
-- Greenfield/additive: prod에는 requests/user_devices/user_progress만 존재.
-- contents.id는 NEW v2 content.id (예: "3_bZr1vzepk_p1"); legacy_video_id는 OLD YouTube id로
-- 1→N split이 같은 값을 공유하므로 non-unique (인덱스만). 쓰기는 service_role 전용.

create table if not exists seasons (
  id text primary key,            -- "103-main"
  name text not null,
  sort_order integer not null
);

create table if not exists episodes (
  id text primary key,            -- playlist.json episode.id
  season_id text not null references seasons(id) on delete cascade,
  episode_number integer not null,
  title_ko text,
  title_jp text,
  sort_order integer not null
);

create table if not exists contents (
  id text primary key,            -- NEW v2 content.id, 예: "3_bZr1vzepk_p1"
  episode_id text not null references episodes(id) on delete cascade,
  type text not null check (
    type in ('story', 'fesxlive', 'fesxrec', 'music', 'withxmeets', 'special', 'unavailable')
  ),
  title_ko text,
  title_jp text,
  part_label text,
  legacy_video_id text not null,  -- OLD YouTube id; NON-unique (1→N split이 공유)
  sort_order integer not null,
  category_override text check (
    category_override in ('story', 'music', 'fesxlive', 'withxmeets', 'fesxrec')
    or category_override is null
  )
);
create index if not exists idx_contents_legacy on contents(legacy_video_id);

create table if not exists content_sources (
  id uuid primary key default gen_random_uuid(),
  content_id text not null references contents(id) on delete cascade,
  url text not null,
  label text,
  timestamp_todo boolean not null default false,
  sort_order integer not null default 0,
  -- 시드가 (content_id, sort_order) 기준으로 멱등 upsert 하기 위해 필요
  unique (content_id, sort_order)
);

alter table seasons enable row level security;
alter table episodes enable row level security;
alter table contents enable row level security;
alter table content_sources enable row level security;

-- 카탈로그는 공개 읽기 (비인증 포함); 쓰기는 service_role 전용 — 별도 정책 없음
create policy "public read seasons"         on seasons         for select using (true);
create policy "public read episodes"        on episodes        for select using (true);
create policy "public read contents"        on contents        for select using (true);
create policy "public read content_sources" on content_sources for select using (true);
