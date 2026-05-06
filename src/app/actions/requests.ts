"use server";

import { supabase } from "@/lib/supabase";

export async function submitAddRequest(data: {
  link: string;
  category: string;
  generation: string;
  description: string;
}) {
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
    throw new Error("요청을 제출하는 데 실패했습니다.");
  }
}

export async function submitEditRequest(data: {
  video_title: string;
  request_type: string;
  category: string;
  generation: string;
  description: string;
}) {
  const { error } = await supabase.from("requests").insert({
    type: "edit",
    video_title: data.video_title,
    request_type: data.request_type,
    category: data.category,
    generation: data.generation,
    description: data.description,
    status: "pending",
  });

  if (error) {
    console.error("Failed to submit edit request:", error);
    throw new Error("요청을 제출하는 데 실패했습니다.");
  }
}
