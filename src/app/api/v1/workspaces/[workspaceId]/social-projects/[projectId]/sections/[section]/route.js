import { studioRoutes } from "@/server/studio/routes.js";
import { socialEngine } from "@/modules/social/service.js";

export const { PUT } = studioRoutes(socialEngine).section;
