import { describe, expect, it } from "vitest";
import { createBusiness } from "@/server/businesses/service.js";
import { approveContextDraft, getApprovedContext, getContextOverview, saveContextDraft } from "@/server/businesses/context-service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { addMember, createUser } from "../helpers/factories.js";

async function setup() {
  const owner = await createUser();
  const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Bloom Bakery", stage: "IDEA" });
  return { owner, biz };
}

describe("central business context", () => {
  it("exposes only approved sections to AI consumers", async () => {
    const { owner, biz } = await setup();
    await saveContextDraft(owner.user, owner.workspace.id, biz.id, { data: { basics: { name: "Bloom" }, audience: { who: "Families" } } });
    const scope = await requireWorkspaceAccess(owner.user, owner.workspace.id);
    expect(await getApprovedContext(scope, biz.id)).toBeNull();

    await approveContextDraft(owner.user, owner.workspace.id, biz.id, { sections: ["basics"] });
    const ctx = await getApprovedContext(scope, biz.id);
    expect(ctx.data).toEqual({ basics: { name: "Bloom" } });
    expect(ctx.version).toBe(1);
  });

  it("versions approvals and supersedes the previous one", async () => {
    const { owner, biz } = await setup();
    await saveContextDraft(owner.user, owner.workspace.id, biz.id, { data: { basics: { name: "v1" } } });
    await approveContextDraft(owner.user, owner.workspace.id, biz.id, { sections: ["basics"] });
    await saveContextDraft(owner.user, owner.workspace.id, biz.id, { data: { basics: { name: "v2" } } });
    // Saving again updates the same open draft instead of creating a new version.
    const draft = await saveContextDraft(owner.user, owner.workspace.id, biz.id, { data: { basics: { name: "v2b" } } });
    expect(draft.version).toBe(2);
    await approveContextDraft(owner.user, owner.workspace.id, biz.id, { sections: ["basics"] });

    const { approved, draft: open } = await getContextOverview(owner.user, owner.workspace.id, biz.id);
    expect(approved.version).toBe(2);
    expect(approved.data.basics.name).toBe("v2b");
    expect(open).toBeNull();
  });

  it("requires approval permission", async () => {
    const { owner, biz } = await setup();
    const editor = await createUser();
    await addMember(owner.workspace.id, editor.user.id, "EDITOR");
    await saveContextDraft(editor.user, owner.workspace.id, biz.id, { data: { basics: { name: "x" } } });
    await expect(approveContextDraft(editor.user, owner.workspace.id, biz.id, { sections: ["basics"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to approve when there is no draft", async () => {
    const { owner, biz } = await setup();
    await expect(approveContextDraft(owner.user, owner.workspace.id, biz.id, { sections: ["basics"] })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
