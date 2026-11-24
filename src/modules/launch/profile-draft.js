import "server-only";
import { getBusinessProfile } from "@/server/businesses/profile-service.js";
import { profileFromLaunchContent } from "@/server/businesses/profile-utils.js";
import { getActiveLaunchContent } from "./service.js";

/** Profile pre-filled from the project's current outputs (not saved). */
export async function getProfileDraftForProject(user, workspaceId, projectId) {
  const { project, content } = await getActiveLaunchContent(user, workspaceId, projectId);
  const { profile, context, permissions } = await getBusinessProfile(user, workspaceId, project.businessId);
  return {
    businessId: project.businessId,
    profile: profileFromLaunchContent({ input: project.input, content, business: project.business, current: profile }),
    savedProfile: profile,
    context,
    permissions,
  };
}
