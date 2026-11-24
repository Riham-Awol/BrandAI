import { studioRoutes } from "@/server/studio/routes.js";
import { socialEngine } from "@/modules/social/service.js";

export const maxDuration = 300;
export const { POST } = studioRoutes(socialEngine).generate;
