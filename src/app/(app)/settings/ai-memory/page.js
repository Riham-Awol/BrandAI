import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getAiMemory } from "@/server/ai/memory.js";
import { AiMemory } from "@/components/settings/ai-memory";

export const metadata = { title: "AI memory" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/ai-memory");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const data = await loadOr404(() => getAiMemory(user, active.id));
  return <AiMemory key={active.id} workspaceId={active.id} initial={JSON.parse(JSON.stringify(data))} />;
}
