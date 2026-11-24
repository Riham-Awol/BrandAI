import "server-only";
import { z } from "zod";
import { ok } from "../http/api-response.js";
import { parseWith, route } from "../http/route-handler.js";

const generateSchema = z.object({ feedback: z.string().trim().max(1000).optional() });
const editSchema = z.object({ content: z.record(z.string(), z.unknown()), state: z.record(z.string(), z.unknown()).optional() });
const acceptSchema = z.object({ outputId: z.uuid() });
const stateSchema = z.object({ outputId: z.uuid(), state: z.record(z.string(), z.unknown()) });

/**
 * Standard route handlers for a studio built with createStudioEngine.
 * Route files re-export these, e.g. `export const { GET, DELETE } = studioRoutes(engine).project;`
 */
export function studioRoutes(engine) {
  return {
    project: {
      GET: route({}, async ({ user, params }) => ok(await engine.getProject(user, params.workspaceId, params.projectId))),
      DELETE: route({}, async ({ user, params, requestInfo }) => {
        await engine.deleteProject(user, params.workspaceId, params.projectId, requestInfo);
        return ok({ deleted: true });
      }),
    },
    section: {
      PUT: route({}, async ({ user, params, json, requestInfo }) => {
        const { content, state } = parseWith(editSchema, await json());
        return ok(await engine.editSection(user, params.workspaceId, params.projectId, params.section, content, requestInfo, { state }), { status: 201 });
      }),
    },
    generate: {
      POST: route({}, async ({ user, params, json, requestInfo }) => {
        const input = parseWith(generateSchema, await json());
        return ok(await engine.generateSection(user, params.workspaceId, params.projectId, params.section, input, requestInfo), { status: 201 });
      }),
    },
    accept: {
      POST: route({}, async ({ user, params, json, requestInfo }) => {
        const { outputId } = parseWith(acceptSchema, await json());
        return ok(await engine.acceptSectionVersion(user, params.workspaceId, params.projectId, params.section, outputId, requestInfo));
      }),
    },
    version: {
      GET: route({}, async ({ user, params }) => ok(await engine.getSectionVersion(user, params.workspaceId, params.projectId, params.section, params.outputId))),
    },
    state: {
      PATCH: route({}, async ({ user, params, json }) => {
        const { outputId, state } = parseWith(stateSchema, await json());
        return ok(await engine.updateSectionState(user, params.workspaceId, params.projectId, params.section, outputId, state));
      }),
    },
  };
}
