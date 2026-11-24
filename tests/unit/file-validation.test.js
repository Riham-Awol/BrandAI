import { describe, expect, it } from "vitest";
import { detectMimeType, sanitizeFileName, validateUpload } from "@/server/storage/file-validation.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("file validation", () => {
  it("detects types from magic bytes", () => {
    expect(detectMimeType(png)).toBe("image/png");
    expect(detectMimeType(webp)).toBe("image/webp");
    expect(detectMimeType(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
  });

  it("rejects SVG/HTML even when disguised", () => {
    expect(validateUpload(Buffer.from('<svg onload="alert(1)"></svg>')).ok).toBe(false);
    expect(validateUpload(Buffer.from("<html><script></script></html>")).ok).toBe(false);
  });

  it("enforces size limits and empty files", () => {
    expect(validateUpload(Buffer.alloc(0)).ok).toBe(false);
    expect(validateUpload(png, { maxBytes: 4 }).ok).toBe(false);
  });

  it("returns a checksum and extension for valid files", () => {
    const r = validateUpload(png);
    expect(r).toMatchObject({ ok: true, mimeType: "image/png", ext: "png" });
    expect(r.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sanitizes file names (no paths, no dotfiles)", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("My Logo (final).png")).toBe("My-Logo-final.png");
    expect(sanitizeFileName("")).toBe("file");
  });
});
