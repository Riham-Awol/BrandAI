import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { listPostsForMetrics } from "@/modules/analytics/service.js";
import { analyticsQuerySchema } from "@/modules/analytics/schemas.js";
import { PostResults } from "@/modules/analytics/components/post-results";

export const metadata = { title: "Post results" };

export default function PostResultsPage({ searchParams }) {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Posts searchParams={searchParams} /></Suspense>;
}

async function Posts({ searchParams }) {
  const user = await requireUserOrRedirect("/analytics/posts");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const parsed = analyticsQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? { ...parsed.data, days: Math.max(parsed.data.days, 90) } : { days: 90 };
  const data = await loadOr404(() => listPostsForMetrics(user, active.id, query));
  return <PostResults workspaceId={active.id} posts={JSON.parse(JSON.stringify(data.posts))} canEdit={data.canEdit} days={query.days} />;
}
