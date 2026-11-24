import { studioRoutes } from "@/server/studio/routes.js";
import { strategyEngine } from "@/modules/strategy/service.js";

export const { GET } = studioRoutes(strategyEngine).version;
