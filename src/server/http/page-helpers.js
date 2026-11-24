import "server-only";
import { notFound } from "next/navigation";
import { isAppError } from "../errors.js";

/** Runs a service call from a page, turning NOT_FOUND / FORBIDDEN into a 404 page. */
export async function loadOr404(fn) {
  try {
    return await fn();
  } catch (error) {
    if (isAppError(error) && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound();
    throw error;
  }
}
