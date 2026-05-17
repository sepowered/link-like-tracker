# 콘텐츠 추가 시 기록 상태 관리 분석

현재 구조에서는 “콘텐츠 목록”과 “기록 상태”가 `video.id`로 느슨하게 연결되어 관리됩니다. 따라서 콘텐츠를 추가할 때 핵심 원칙은 **기존 `video.id`를 절대 바꾸지 않고, 새 콘텐츠는 새 고유 ID로 append**하는 것입니다.

## 현재 관리 방식

콘텐츠 원본은 `data/playlist.json`이며 `src/lib/playlist.json.ts`의 `jsonStorage`가 읽고 씁니다. `src/app/page.tsx`는 이 데이터를 불러와 `PlaylistView`에 넘깁니다.

기록 상태는 두 갈래입니다. 비로그인 사용자는 브라우저 `localStorage`의 `llt-watched`, `llt-overrides`를 씁니다. 로그인 사용자는 `llt-progress-v2-${userId}-${deviceId}` 로컬 저장소와 Supabase `user_progress` 테이블을 함께 씁니다. Supabase의 기록 키는 `(user_id, device_id, video_id)`입니다.

## 콘텐츠 추가 시 동작

새 영상이 기존 playlist에 **새 `video.id`로 추가**되면 기존 기록은 그대로 유지됩니다. 새 영상은 기록이 없으므로 기본적으로 `watched: false` 상태로 보이고, 사용자가 시청 처리하거나 카테고리를 바꾸는 순간 해당 `videoId` 기준으로 기록이 생성됩니다.

반대로 기존 영상의 `id`를 바꾸면 시스템은 그것을 “기존 영상 수정”이 아니라 “기존 영상 삭제 + 새 영상 추가”처럼 봅니다. 기존 시청 기록은 예전 ID에 남고 새 ID에는 이어지지 않습니다. 삭제된 영상의 기록도 Supabase/localStorage에 남을 수 있지만 화면에 매칭되는 콘텐츠가 없어서 사실상 무시됩니다.

## 권장 정책

콘텐츠 추가는 append-only로 처리하는 게 안전합니다.

1. 기존 `video.id`는 변경하지 않는다.
2. 새 콘텐츠는 새 고유 `id`를 가진다.
3. 기존 기록을 title/url/순서로 추론해 옮기지 않는다.
4. ID 변경이 꼭 필요하면 별도의 명시적 `oldId -> newId` 마이그레이션 정책을 만든다.
5. 삭제된 콘텐츠의 orphan progress는 당장 정리하지 않고 무시해도 현재 구조와 맞다.

## 검증 기준

콘텐츠 추가 후 기존 사용자의 `llt-watched`, `llt-overrides`, `llt-progress-v2-*`, Supabase `user_progress.video_id`가 기존 ID 기준으로 그대로 유지되면 통과입니다.

새 콘텐츠는 처음에는 미시청 상태이고, 사용자가 조작한 뒤에만 해당 새 `videoId` 기록이 생겨야 합니다.
