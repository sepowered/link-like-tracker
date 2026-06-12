import type { ComponentType } from "react";
import Update202606V2 from "./2026-06-v2";

/** slug → 본문 컴포넌트. registry.ts 의 UPDATE_POSTS 와 1:1 로 유지할 것. */
export const POST_COMPONENTS: Record<string, ComponentType> = {
  "2026-06-v2": Update202606V2,
};
