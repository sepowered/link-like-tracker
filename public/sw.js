/**
 * 자가 제거(self-destroying) 서비스 워커.
 *
 * 이 앱은 서비스 워커를 등록하지 않는다(등록 코드 없음). 이 파일이 존재하는
 * 유일한 이유는, 과거에 같은 오리진(예: localhost:3000)에서 돌던 다른 앱이
 * 등록해 둔 "고아 서비스 워커"를 청소하기 위해서다.
 *
 * 서비스 워커는 프로젝트가 아니라 오리진 단위로 살아남는다. 옛 SW가 옛 빌드의
 * HTML/청크를 캐시해 내놓으면, 청크 해시가 바뀐 현재 서버와 충돌해 청크 404 →
 * 무한 새로고침 루프가 난다. 브라우저는 네비게이션마다 /sw.js 업데이트를
 * 네트워크에서 확인하므로, 이 파일을 받으면 새 SW가 설치되고 아래 activate에서
 * 스스로 등록을 해제하고 모든 캐시를 비운 뒤 클라이언트를 1회 새로고침한다.
 *
 * 깨끗한 클라이언트는 이 파일을 받을 일이 없다(아무도 register하지 않음).
 */

self.addEventListener("install", () => {
  // 대기열을 건너뛰고 즉시 활성화로 진입한다.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1) 옛 SW가 만든 모든 캐시를 삭제한다.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // 2) 자기 자신을 등록 해제한다(이 오리진의 SW 제어를 끝낸다).
      await self.registration.unregister();

      // 3) 제어 중이던 모든 창을 새로고침해, SW 없는 깨끗한 상태로 되돌린다.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        // navigate는 동일 URL 재요청 → 이번엔 SW가 빠진 네트워크 응답을 받는다.
        client.navigate(client.url);
      }
    })(),
  );
});
