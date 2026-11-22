"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { TabsList } from "../../../../components/ui/tabs";
import { useI18n } from "../../../i18n-provider";
import AdminSocialTemplatesSection from "../../components/AdminSocialTemplatesSection";
import { CarouselsPanel, publicationCounts, PublishedPanel, ReelsPanel } from "../../publications/PublicationViews";
import { POSTS_TABS, readPostsHighlight, readPostsTab, type PostsTab } from "../../publications/publication-tabs";
import { usePublicationsWorkspace } from "../../publications/usePublicationsWorkspace";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

const countLabel = (label: string, count: number) => (count ? `${label} · ${count}` : label);

function PostsContent() {
  const accessToken = useAdminAccessToken();
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams()?.toString() ?? "";
  const tab = readPostsTab(search);
  const highlight = readPostsHighlight(search);
  const workspace = usePublicationsWorkspace(accessToken);
  const counts = publicationCounts(workspace.posts);

  // « Voir » from the calendar: scroll to the post or plan item once the lists are there.
  const anchor = highlight.postId ? `post-${highlight.postId}` : highlight.itemId ? `automation-${highlight.itemId}` : null;
  const scrolled = useRef<string | null>(null);
  const ready = Boolean(workspace.postsQuery.data && (workspace.automationQuery.data || workspace.carouselQuery.data));
  useEffect(() => {
    if (!anchor || !ready || scrolled.current === anchor) return;
    scrolled.current = anchor;
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [anchor, ready]);

  const setTab = (next: PostsTab) => router.replace((next === "reels" ? "/admin/content/posts" : `/admin/content/posts?onglet=${next}`) as Route, { scroll: false });

  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-max">
          <TabsList
            tabs={POSTS_TABS.map((item) => ({
              id: item.id,
              label: item.id === "reels" ? countLabel(item.label, counts.reels) : item.id === "carousels" ? countLabel(item.label, counts.carousels) : item.id === "published" ? countLabel(item.label, counts.published) : item.label,
            }))}
            activeTab={tab}
            onTabChange={(id) => setTab(id as PostsTab)}
          />
        </div>
      </div>
      <div className="mt-6">
        {tab === "reels" ? <ReelsPanel workspace={workspace} highlight={highlight} /> : null}
        {tab === "carousels" ? <CarouselsPanel workspace={workspace} highlight={highlight} /> : null}
        {tab === "published" ? <PublishedPanel workspace={workspace} highlight={highlight} /> : null}
        {tab === "templates" ? <AdminSocialTemplatesSection accessToken={accessToken} t={t.admin.socialTemplates} /> : null}
      </div>
    </>
  );
}

/** Publications: reels, carrousels, publiées (former Publications tabs) and the manual carousel (« Templates sociaux »). */
export default function AdminContentPostsPage() {
  return (
    <>
      <AdminPageHeader title="Publications" description="Reels et carrousels Instagram : préparer, contrôler, publier." />
      <Suspense fallback={null}>
        <PostsContent />
      </Suspense>
    </>
  );
}
