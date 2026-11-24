import { studioRoutes } from "@/server/studio/routes.js";
import { strategyEngine } from "@/modules/strategy/service.js";

export const maxDuration = 300;
export const { POST } = studioRoutes(strategyEngine).generate;
