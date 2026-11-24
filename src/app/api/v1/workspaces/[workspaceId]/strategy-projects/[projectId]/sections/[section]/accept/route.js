import { studioRoutes } from "@/server/studio/routes.js";
import { strategyEngine } from "@/modules/strategy/service.js";

export const { POST } = studioRoutes(strategyEngine).accept;
