import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const COST = 12;

export function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}

let dummyHashPromise;

/**
 * Hash of a random secret, computed once with the real cost factor. Compared
 * against when the user does not exist so login timing does not reveal which
 * emails are registered.
 */
export function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash(randomBytes(16).toString("hex"), COST);
  return dummyHashPromise;
}
