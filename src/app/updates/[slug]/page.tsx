import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import TermsPageHeader from "@/components/TermsPageHeader";
import { getPublishedAnnouncement } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedAnnouncement(slug);
  if (!post) return {};
  return { title: `${post.title} — link-like-tracker` };
}

export default async function UpdatePostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedAnnouncement(slug);
  if (!post) notFound();

  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title={post.title} />
        <article className="terms-page">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
              // 외부 링크는 새 탭으로 — 시청 흐름(메인 SPA 상태)을 잃지 않게
              a: ({ children, ...props }) => (
                <a {...props} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {post.body_md}
          </ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
