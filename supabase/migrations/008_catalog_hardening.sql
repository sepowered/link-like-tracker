-- 008_catalog_hardening.sql — 카탈로그 v2 구조 보강 (프로덕션 전환 준비)
--
-- 전부 추가적(additive)·멱등: 기존 행을 변형/삭제하는 구문이 하나도 없다.
-- 기존 유저 데이터(user_progress 등)는 일절 건드리지 않는다 — 최상위 하드 제약.
-- Supabase migration history가 없는 수동 적용 DB에서도 재실행 가능해야 한다.

-- ── 1) FK 컬럼 인덱스 ──────────────────────────────────────────────────────
-- PostgREST 중첩 select(seasons→episodes→contents→content_sources)와
-- on delete cascade 모두 FK 컬럼 조회를 타므로 인덱스가 필요하다.
create index if not exists idx_episodes_season        on episodes(season_id);
create index if not exists idx_contents_episode       on contents(episode_id);
create index if not exists idx_content_sources_content on content_sources(content_id);

-- ── 2) 감사 타임스탬프 ─────────────────────────────────────────────────────
-- 백오피스 편집·CSV 가져오기 추적용. 기존 행은 적용 시점 now()로 채워진다
-- (행 값 변형이 아니라 컬럼 추가 — 카탈로그는 아직 프로덕션 미사용이라 무해).
alter table contents        add column if not exists created_at timestamptz not null default now();
alter table contents        add column if not exists updated_at timestamptz not null default now();
alter table content_sources add column if not exists created_at timestamptz not null default now();
alter table content_sources add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_contents_updated_at on contents;
create trigger trg_contents_updated_at
  before update on contents
  for each row execute function set_updated_at();

drop trigger if exists trg_content_sources_updated_at on content_sources;
create trigger trg_content_sources_updated_at
  before update on content_sources
  for each row execute function set_updated_at();

-- ── 3) 스키마 의도 문서화 ──────────────────────────────────────────────────
-- user_progress.video_id 는 의도적으로 contents(id) FK가 없다:
--   * 기존 유저 행은 legacy YouTube id를 담고 있고(읽기 시 legacy-map으로 확장),
--   * 카탈로그에서 콘텐츠가 삭제되어도 시청 기록은 보존되어야 하기 때문(하드 제약).
comment on column user_progress.video_id is
  'content.id 또는 legacy YouTube id. 의도적으로 FK 없음 — 알 수 없는 id도 보존(클라이언트 legacy-map이 읽기 시 확장).';
comment on column contents.legacy_video_id is
  '옛 YouTube id. 1→N 분할이 같은 값을 공유하므로 non-unique. UPDATE 경로에서 절대 갱신 금지(006 참조).';
