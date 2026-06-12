import { notFound } from "next/navigation";
import TermsPageHeader from "@/components/TermsPageHeader";
import { UPDATE_POSTS } from "@/content/updates/registry";
import { POST_COMPONENTS } from "@/content/updates/posts";

export function generateStaticParams() {
  return UPDATE_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = UPDATE_POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: `${post.title} — link-like-tracker` };
}

export default async function UpdatePostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = UPDATE_POSTS.find((p) => p.slug === slug);
  const Body = POST_COMPONENTS[slug];
  if (!post || !Body) notFound();

  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title={post.title} />
        <article className="terms-page">
          <Body />
        </article>
      </div>
    </main>
  );
}
