import Link from "next/link";
import TermsPageHeader from "@/components/TermsPageHeader";
import { listPublishedAnnouncements } from "@/lib/announcements";
import { formatAnnouncementDate } from "@/lib/admin/announcements-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "공지사항 — link-like-tracker",
};

export default async function UpdatesPage() {
  const posts = await listPublishedAnnouncements();

  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title="공지사항" />
        {posts.length === 0 ? (
          <p className="updates-empty">아직 올라온 공지가 없어요.</p>
        ) : (
          <nav className="updates-list" aria-label="공지 목록">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/updates/${post.slug}`}
                className="updates-list-item"
              >
                <span className="updates-list-title">{post.title}</span>
                <span className="updates-list-summary">{post.summary}</span>
                <time className="updates-list-date" dateTime={post.published_at}>
                  {formatAnnouncementDate(post.published_at)}
                </time>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
