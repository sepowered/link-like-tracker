"use server";

import { getSupabaseClient } from "@/lib/supabase";

export async function submitAddRequest(data: {
  link: string;
  category: string;
  generation: string;
  description: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("requests").insert({
    type: "add",
    link: data.link,
    category: data.category,
    generation: data.generation,
    description: data.description,
    status: "pending",
  });

  if (error) {
    console.error("Failed to submit add request:", error);
    throw new Error(`[Supabase Error] ${error.message} (${error.code})`);
  }
}

export async function submitEditRequest(data: {
  content_id: string;
  video_title: string;
  request_type: string;
  category: string;
  generation: string;
  description: string;
}) {
  const supabase = getSupabaseClient();
  // D2: 편집 폼이 아는 content.id를 함께 보낸다. 익명이 직접 INSERT하면 트리거가
  // content_id를 null로 강등하므로, 서버에서 검증·보존하는 submit_edit_request RPC로 보낸다.
  const { error } = await supabase.rpc("submit_edit_request", {
    p_content_id: data.content_id,
    p_video_title: data.video_title,
    p_request_type: data.request_type,
    p_category: data.category,
    p_generation: data.generation,
    p_description: data.description,
  });

  if (error) {
    console.error("Failed to submit edit request:", error);
    throw new Error(`[Supabase Error] ${error.message} (${error.code})`);
  }
}
