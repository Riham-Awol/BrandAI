import { studioRoutes } from "@/server/studio/routes.js";
import { profileEngine } from "@/modules/stationery/profile-service.js";

export const maxDuration = 300;
export const { POST } = studioRoutes(profileEngine).generate;
