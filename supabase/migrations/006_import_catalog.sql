-- 006_import_catalog.sql — 카탈로그 CSV 가져오기용 원자적 upsert 함수
-- contents + content_sources만 한 트랜잭션 안에서 upsert 한다(삭제 없음).
-- 서버 액션이 service_role 클라이언트로 `select import_catalog(payload)` 호출.
--
-- 원자성 — Postgres 함수는 호출자의 단일 (암묵) 트랜잭션 안에서 실행되므로,
-- 어느 한 행이라도 제약(타입 enum / FK / UNIQUE)을 어기면 RAISE → 함수 전체가
-- 롤백된다. 부분 커밋이 없어 카탈로그가 절반만 바뀌는 일이 없다.
--
-- legacy_video_id — UPDATE 경로에서 절대 건드리지 않는다(1→N 분할이 같은 값을
-- 공유하고 user_progress.video_id가 FK 없이 이 값을 참조하므로). INSERT 시에만 필수.
--
-- sort_order — payload 배열 순서로 부여한다(에피소드 내 콘텐츠, 콘텐츠 내 소스).
-- content_sources에는 UNIQUE(content_id, sort_order)가 있어, catalog-repo.ts의
-- reorderContentSources와 동일한 +10000 2단계 오프셋으로 중간 충돌을 피한다.
--
-- Supabase migration history가 없는 기존 수동 적용 DB에서도 재실행 가능해야 한다(멱등).

create or replace function import_catalog(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_created_contents int := 0;
  v_updated_contents int := 0;
  v_created_sources  int := 0;
  v_updated_sources  int := 0;
  rec     record;
  v_exists boolean;
begin
  -- ── Contents upsert (id = text PK) ───────────────────────────────────
  -- sort_order = 에피소드 그룹 내 payload 배열 순서(0-기반).
  -- contents에는 (episode_id, sort_order) UNIQUE가 없어 단순 부여로 충분하다.
  for rec in
    select
      elem->>'id'                            as id,
      elem->>'episode_id'                    as episode_id,
      elem->>'type'                          as type,
      elem->>'title_ko'                      as title_ko,
      elem->>'title_jp'                      as title_jp,
      elem->>'part_label'                    as part_label,
      elem->>'legacy_video_id'               as legacy_video_id,
      nullif(elem->>'category_override', '') as category_override,
      (row_number() over (partition by elem->>'episode_id' order by ord) - 1)::int as sort_order
    from jsonb_array_elements(coalesce(payload->'contents', '[]'::jsonb))
         with ordinality as t(elem, ord)
  loop
    select exists(select 1 from contents where id = rec.id) into v_exists;

    if v_exists then
      -- legacy_video_id는 의도적으로 갱신에서 제외(READ-ONLY)
      update contents set
        episode_id        = rec.episode_id,
        type              = rec.type,
        title_ko          = rec.title_ko,
        title_jp          = rec.title_jp,
        part_label        = rec.part_label,
        category_override = rec.category_override,
        sort_order        = rec.sort_order
      where id = rec.id;
      v_updated_contents := v_updated_contents + 1;
    else
      if rec.legacy_video_id is null or rec.legacy_video_id = '' then
        raise exception 'import_catalog: legacy_video_id는 새 콘텐츠(%)에 필수입니다', rec.id;
      end if;
      insert into contents
        (id, episode_id, type, title_ko, title_jp, part_label,
         legacy_video_id, sort_order, category_override)
      values
        (rec.id, rec.episode_id, rec.type, rec.title_ko, rec.title_jp, rec.part_label,
         rec.legacy_video_id, rec.sort_order, rec.category_override);
      v_created_contents := v_created_contents + 1;
    end if;
  end loop;

  -- ── Content sources: 2단계 오프셋으로 UNIQUE(content_id, sort_order) 보호 ──
  -- Phase 1) UPDATE 대상(기존 id)을 sort_order + 10000으로 옮겨 0..n-1 범위를 비운다.
  --          row_number는 insert(빈 id) 행까지 포함해 매기므로 phase 2와 인덱스가 일치한다.
  for rec in
    select
      nullif(elem->>'id', '') as id,
      (row_number() over (partition by elem->>'content_id' order by ord) - 1)::int as sort_order
    from jsonb_array_elements(coalesce(payload->'sources', '[]'::jsonb))
         with ordinality as t(elem, ord)
  loop
    if rec.id is not null then
      update content_sources set sort_order = 10000 + rec.sort_order where id = rec.id::uuid;
    end if;
  end loop;

  -- Phase 2) 최종값 기록 — 빈 id는 INSERT(gen_random_uuid), 기존 id는 UPDATE by id.
  for rec in
    select
      nullif(elem->>'id', '')  as id,
      elem->>'content_id'      as content_id,
      elem->>'url'             as url,
      elem->>'label'           as label,
      coalesce((elem->>'timestamp_todo')::boolean, false) as timestamp_todo,
      (row_number() over (partition by elem->>'content_id' order by ord) - 1)::int as sort_order
    from jsonb_array_elements(coalesce(payload->'sources', '[]'::jsonb))
         with ordinality as t(elem, ord)
  loop
    if rec.id is null then
      insert into content_sources (content_id, url, label, timestamp_todo, sort_order)
      values (rec.content_id, rec.url, rec.label, rec.timestamp_todo, rec.sort_order);
      v_created_sources := v_created_sources + 1;
    else
      update content_sources set
        content_id     = rec.content_id,
        url            = rec.url,
        label          = rec.label,
        timestamp_todo = rec.timestamp_todo,
        sort_order     = rec.sort_order
      where id = rec.id::uuid;
      if not found then
        raise exception 'import_catalog: 소스 id %를 찾을 수 없습니다', rec.id;
      end if;
      v_updated_sources := v_updated_sources + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created_contents', v_created_contents,
    'updated_contents', v_updated_contents,
    'created_sources',  v_created_sources,
    'updated_sources',  v_updated_sources
  );
end;
$$;
