import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, consumeRecoveryCode, generateRecoveryCodes, otpauthUri, totpAt, verifyTotp } from "@/server/auth/totp.js";

// RFC 6238 Appendix B test secret ("12345678901234567890"), SHA-1, truncated to 6 digits.
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpAt(SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("round-trips base32", () => {
    const buf = Buffer.from([0, 1, 2, 250, 255, 7]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("accepts ±1 step, refuses reuse and junk", () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(1234567890 / 30);
    expect(verifyTotp(SECRET, "005924", { now })).toBe(step);
    expect(verifyTotp(SECRET, totpAt(SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(SECRET, totpAt(SECRET, step - 2), { now })).toBeNull();
    expect(verifyTotp(SECRET, "005924", { now, lastStep: step })).toBeNull();
    expect(verifyTotp(SECRET, "abc", { now })).toBeNull();
    expect(otpauthUri({ secret: SECRET, account: "a@b.co" })).toBe(`otpauth://totp/Brand%20AI:a%40b.co?secret=${SECRET}&issuer=Brand%20AI&algorithm=SHA1&digits=6&period=30`);
  });

  it("recovery codes are single use and stored hashed", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/);
    expect(hashes.join()).not.toContain(codes[0]);
    const left = consumeRecoveryCode(hashes, codes[3].toUpperCase().replace("-", " "));
    expect(left).toHaveLength(9);
    expect(consumeRecoveryCode(left, codes[3])).toBeNull();
  });
});
