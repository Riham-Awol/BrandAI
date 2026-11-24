import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { uuidSchema } from "@/validation/common.js";
import { checkPost, dateForDay, normalizePostContent, PLATFORMS } from "./platforms.js";
import { generatedPostsSchema, postContentSchema } from "./schemas.js";
import { postsInput, postsInstructions } from "./prompts.js";
import { postsCsv, postsMarkdown } from "./export.js";
import { socialEngine } from "./service.js";

const postSelect = {
  id: true, scheduledDate: true, platform: true, format: true, pillar: true, title: true, objective: true,
  isPromotion: true, status: true, content: true, version: true, isMock: true, calendarOutputId: true, createdAt: true, updatedAt: true,
};

function present(post) {
  const date = post.scheduledDate.toISOString().slice(0, 10);
  return { ...post, scheduledDate: date, checks: post.content ? checkPost(post.platform, post.format, post.content) : null };
}

async function scopedProject(user, workspaceId, projectId, permission) {
  const scope = await requireWorkspaceAccess(user, workspaceId, permission);
  const project = await socialEngine.findScopedProject(scope, projectId);
  return { scope, project };
}

async function findPost(project, postId) {
  if (!uuidSchema.safeParse(postId).success) throw Errors.notFound();
  const post = await prisma.socialPost.findFirst({ where: { id: postId, projectId: project.id, deletedAt: null } });
  if (!post) throw Errors.notFound();
  return post;
}

function assertDateInMonth(project, date) {
  if (!date.startsWith(project.input.month)) throw Errors.validation({ date: [`Choose a date in ${project.input.month}.`] });
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw Errors.validation({ date: ["Invalid date."] });
  return d;
}

function assertFormat(platform, format) {
  if (!PLATFORMS[platform].formats.includes(format)) throw Errors.validation({ format: [`This format is not available on ${PLATFORMS[platform].label}.`] });
}

export async function listPosts(user, workspaceId, projectId) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_READ);
  const posts = await prisma.socialPost.findMany({ where: { projectId: project.id, deletedAt: null }, orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }], select: postSelect });
  return posts.map(present);
}

export async function getPost(user, workspaceId, projectId, postId) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_READ);
  const post = await findPost(project, postId);
  const revisions = await prisma.socialPostRevision.findMany({ where: { postId: post.id }, orderBy: { version: "desc" }, select: { id: true, version: true, source: true, content: true, feedback: true, createdAt: true } });
  return { ...present(post), revisions };
}

/** Creates IDEA posts from the active calendar; ideas from an older calendar that were never written are replaced. */
export async function createPostsFromCalendar(user, workspaceId, projectId, request) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_UPDATE);
  const { calendar } = await socialEngine.activeOutputs(project.id, ["calendar"]);
  if (!calendar) throw new AppError("CONFLICT", "Generate the content calendar first.", 409);
  const existing = await prisma.socialPost.count({ where: { projectId: project.id, calendarOutputId: calendar.id, deletedAt: null } });
  if (existing > 0) return { created: 0, alreadyCreated: existing };

  const { count: replaced } = await prisma.socialPost.updateMany({
    where: { projectId: project.id, status: "IDEA", calendarOutputId: { not: null }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  const rows = calendar.content.entries.map((e) => ({
    workspaceId: project.workspaceId, businessId: project.businessId, projectId: project.id, calendarOutputId: calendar.id,
    scheduledDate: new Date(`${dateForDay(project.input.month, e.day)}T00:00:00Z`), platform: e.platform, format: e.format,
    pillar: e.pillar, title: e.title.slice(0, 200), objective: e.objective?.slice(0, 500), isPromotion: e.isPromotion, createdById: user.id,
  }));
  await prisma.socialPost.createMany({ data: rows });
  await recordAudit({ action: "social.posts_from_calendar", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, metadata: { created: rows.length, replaced }, request });
  return { created: rows.length, replaced };
}

/** Quick tool: a single post (optionally written immediately). */
export async function createPost(user, workspaceId, projectId, input, request) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_UPDATE);
  assertFormat(input.platform, input.format);
  const scheduledDate = assertDateInMonth(project, input.date);
  const post = await prisma.socialPost.create({
    data: {
      workspaceId: project.workspaceId, businessId: project.businessId, projectId: project.id, scheduledDate, platform: input.platform, format: input.format,
      title: input.title, pillar: input.pillar, objective: input.objective, isPromotion: input.isPromotion, createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ action: "social.post_created", actorId: user.id, workspaceId, entityType: "social_post", entityId: post.id, request });
  if (input.generate) await generatePosts(user, workspaceId, projectId, { postIds: [post.id] }, request);
  return getPost(user, workspaceId, projectId, post.id);
}

/** Writes up to 6 posts in one AI call (saves free-tier quota). */
export async function generatePosts(user, workspaceId, projectId, { postIds, feedback }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const project = await socialEngine.findScopedProject(scope, projectId);
  const posts = await prisma.socialPost.findMany({ where: { id: { in: postIds }, projectId: project.id, deletedAt: null }, orderBy: { scheduledDate: "asc" } });
  if (posts.length !== new Set(postIds).size) throw Errors.notFound();
  const { pillars } = await socialEngine.activeOutputs(project.id, ["pillars"]);

  const result = await generateText({
    user, workspaceId, businessId: project.businessId, module: "social", task: "posts",
    instructions: postsInstructions(project.input.platforms),
    input: postsInput({ project, posts, pillars: pillars?.content, feedback }),
    schema: generatedPostsSchema, effort: "medium", maxTokens: 12000, request,
  });

  const byRef = new Map(result.data.posts.map((p) => [Math.round(p.ref), p]));
  const written = [];
  const missing = [];
  for (const [n, post] of posts.entries()) {
    const item = byRef.get(n + 1);
    if (!item) {
      missing.push(post.id);
      continue;
    }
    const { ref: _ref, ...raw } = item;
    const content = normalizePostContent(raw, post);
    const version = post.version + 1;
    await prisma.$transaction([
      prisma.socialPost.update({ where: { id: post.id }, data: { content, version, status: post.status === "READY" ? "READY" : "DRAFT", isMock: result.isMock } }),
      prisma.socialPostRevision.create({ data: { postId: post.id, version, source: "AI", content, feedback: feedback || null, generationId: result.generationId, createdById: user.id } }),
    ]);
    written.push(post.id);
  }
  await recordAudit({ action: "social.posts_generated", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, metadata: { written: written.length, missing: missing.length }, request });
  return { written, missing, isMock: result.isMock };
}

export async function updatePost(user, workspaceId, projectId, postId, input, request) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_UPDATE);
  const post = await findPost(project, postId);
  const data = {};
  if (input.title) data.title = input.title;
  if (input.status) data.status = input.status;
  if (input.isPromotion !== undefined) data.isPromotion = input.isPromotion;
  if (input.date) data.scheduledDate = assertDateInMonth(project, input.date);
  if (input.status === "READY" && !post.content && !input.content) throw Errors.validation({ status: ["Write the post before marking it ready."] });

  const ops = [];
  if (input.content) {
    const parsed = postContentSchema.safeParse(input.content);
    if (!parsed.success) throw Errors.validation({ content: ["Invalid post content."] });
    const content = normalizePostContent(parsed.data, { format: post.format, isPromotion: data.isPromotion ?? post.isPromotion });
    data.content = content;
    data.version = post.version + 1;
    if (post.status === "IDEA" && !input.status) data.status = "DRAFT";
    ops.push(prisma.socialPostRevision.create({ data: { postId: post.id, version: data.version, source: "EDIT", content, createdById: user.id } }));
  }
  await prisma.$transaction([prisma.socialPost.update({ where: { id: post.id }, data }), ...ops]);
  await recordAudit({ action: "social.post_updated", actorId: user.id, workspaceId, entityType: "social_post", entityId: post.id, metadata: { fields: Object.keys(input) }, request });
  return getPost(user, workspaceId, projectId, post.id);
}

export async function deletePost(user, workspaceId, projectId, postId, request) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_UPDATE);
  const post = await findPost(project, postId);
  await prisma.socialPost.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
  await recordAudit({ action: "social.post_deleted", actorId: user.id, workspaceId, entityType: "social_post", entityId: post.id, request });
}

export async function exportPosts(user, workspaceId, projectId, format) {
  const { project } = await scopedProject(user, workspaceId, projectId, PERMISSIONS.BUSINESS_READ);
  const posts = (await prisma.socialPost.findMany({ where: { projectId: project.id, deletedAt: null }, orderBy: { scheduledDate: "asc" }, select: postSelect })).map(present);
  const slug = `${project.business.name.replace(/[^\w-]+/g, "-").toLowerCase() || "social"}-${project.input.month}`;
  if (format === "csv") return { filename: `${slug}-posts.csv`, contentType: "text/csv; charset=utf-8", body: postsCsv(posts) };
  return { filename: `${slug}-posts.md`, contentType: "text/markdown; charset=utf-8", body: postsMarkdown(posts, project) };
}
