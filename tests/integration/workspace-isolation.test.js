import { describe, expect, it } from "vitest";
import { createBusiness, deleteBusiness, getBusiness, listBusinesses, updateBusiness } from "@/server/businesses/service.js";
import { getWorkspace, listWorkspacesForUser, createWorkspaceForUser } from "@/server/workspaces/service.js";
import { prisma } from "@/server/db/prisma.js";
import { addMember, createUser } from "../helpers/factories.js";

describe("workspace data isolation", () => {
  it("never exposes another user's workspace", async () => {
    const a = await createUser();
    const b = await createUser();
    expect((await listWorkspacesForUser(b.user.id)).map((w) => w.id)).not.toContain(a.workspace.id);
    await expect(getWorkspace(b.user, a.workspace.id)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("blocks cross-workspace business access by id", async () => {
    const a = await createUser();
    const b = await createUser();
    const biz = await createBusiness(a.user, a.workspace.id, { name: "Acme", stage: "IDEA" });

    await expect(listBusinesses(b.user, a.workspace.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // B uses their OWN workspace id with A's business id: must look missing.
    await expect(getBusiness(b.user, b.workspace.id, biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateBusiness(b.user, b.workspace.id, biz.id, { name: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteBusiness(b.user, b.workspace.id, biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await prisma.business.findUnique({ where: { id: biz.id } })).name).toBe("Acme");
  });

  it("treats malformed ids as not found", async () => {
    const a = await createUser();
    await expect(getWorkspace(a.user, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBusiness(a.user, a.workspace.id, "' OR 1=1 --")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("role-based permissions", () => {
  it("lets viewers read but not create or delete", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    await addMember(owner.workspace.id, viewer.user.id, "VIEWER");
    const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Shared Co", stage: "IDEA" });

    expect((await listBusinesses(viewer.user, owner.workspace.id)).map((b) => b.id)).toEqual([biz.id]);
    await expect(createBusiness(viewer.user, owner.workspace.id, { name: "Nope", stage: "IDEA" })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(deleteBusiness(viewer.user, owner.workspace.id, biz.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets editors create but not delete", async () => {
    const owner = await createUser();
    const editor = await createUser();
    await addMember(owner.workspace.id, editor.user.id, "EDITOR");
    const biz = await createBusiness(editor.user, owner.workspace.id, { name: "Editor Co", stage: "IDEA" });
    await expect(deleteBusiness(editor.user, owner.workspace.id, biz.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("soft-deletes businesses and hides them from lists", async () => {
    const owner = await createUser();
    const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Temp", stage: "IDEA" });
    await deleteBusiness(owner.user, owner.workspace.id, biz.id);
    expect(await listBusinesses(owner.user, owner.workspace.id)).toEqual([]);
    expect((await prisma.business.findUnique({ where: { id: biz.id } })).deletedAt).not.toBeNull();
  });

  it("creates additional workspaces with the creator as owner", async () => {
    const a = await createUser();
    const ws = await createWorkspaceForUser({ userId: a.user.id, name: "Agency One", type: "AGENCY" });
    const detail = await getWorkspace(a.user, ws.id);
    expect(detail).toMatchObject({ role: "OWNER", type: "AGENCY", memberCount: 1 });
    expect(detail.permissions).toContain("billing:manage");
  });
});
