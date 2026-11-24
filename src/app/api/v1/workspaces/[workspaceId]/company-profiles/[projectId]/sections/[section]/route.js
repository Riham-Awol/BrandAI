import { studioRoutes } from "@/server/studio/routes.js";
import { profileEngine } from "@/modules/stationery/profile-service.js";

export const { PUT } = studioRoutes(profileEngine).section;
