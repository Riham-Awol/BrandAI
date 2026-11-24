import { randomUUID } from "node:crypto";
import { registerUser } from "@/server/auth/service.js";
import { prisma } from "@/server/db/prisma.js";

export async function createUser(overrides = {}) {
  const email = overrides.email ?? `user-${randomUUID().slice(0, 8)}@example.com`;
  const { user, workspace } = await registerUser({ name: overrides.name ?? "Test User", email, password: overrides.password ?? "correct-horse-9" }, { ip: "127.0.0.1" });
  return { user, workspace, email, password: overrides.password ?? "correct-horse-9" };
}

export async function addMember(workspaceId, userId, role) {
  return prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}
