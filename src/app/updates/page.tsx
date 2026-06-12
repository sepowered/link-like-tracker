import Link from "next/link";
import TermsPageHeader from "@/components/TermsPageHeader";
import { UPDATE_POSTS, formatUpdateDate } from "@/content/updates/registry";

export const metadata = {
  title: "공지사항 — link-like-tracker",
};

export default function UpdatesPage() {
  return (
    <main>
      <div className="settings-page">
        <TermsPageHeader title="공지사항" />
        <nav className="updates-list" aria-label="공지 목록">
          {UPDATE_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/updates/${post.slug}`}
              className="updates-list-item"
            >
              <span className="updates-list-title">{post.title}</span>
              <span className="updates-list-summary">{post.summary}</span>
              <time className="updates-list-date" dateTime={post.date}>
                {formatUpdateDate(post.date)}
              </time>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
