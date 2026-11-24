import { studioRoutes } from "@/server/studio/routes.js";
import { profileEngine } from "@/modules/stationery/profile-service.js";

export const { GET } = studioRoutes(profileEngine).version;
