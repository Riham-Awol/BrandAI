import "server-only";
import { PROFILE_SECTION_BY_KEY } from "./profile-sections.js";

const COMMON = [
  "You are a senior corporate copywriter writing a company profile (brochure) in Brand AI.",
  "Use the approved business context: offering, audience, brand voice, mission and values where they exist. Reuse them; do not contradict them.",
  "Never invent facts: no founding years, team sizes, client names, awards, certifications, statistics, revenues, locations or testimonials that are not in the context. Write confidently without them.",
  "Write in plain, specific language in the approved brand voice. Write in English unless the context indicates another language.",
].join(" ");

export function profileInstructions(section) {
  return `${COMMON}\n\nTask — ${PROFILE_SECTION_BY_KEY[section].title}: ${PROFILE_SECTION_BY_KEY[section].description}`;
}

export function profileInput({ project, previous, feedback, currentContent }) {
  const b = project.business;
  const lines = [`<business>\nName: ${b.name}\nIndustry: ${b.industry ?? "not specified"}\nDescription: ${b.description ?? "not specified"}\n</business>`];
  if (project.input?.purpose) lines.push(`<purpose>\n${project.input.purpose}\n</purpose>`);
  for (const [key, entry] of Object.entries(previous)) lines.push(`<previous_result section="${key}">\n${JSON.stringify(entry.content)}\n</previous_result>`);
  if (feedback) {
    if (currentContent) lines.push(`<current_version>\n${JSON.stringify(currentContent)}\n</current_version>`);
    lines.push(`<revision_request>\n${feedback}\n</revision_request>\nRevise the current version according to the revision request.`);
  }
  return lines.join("\n\n");
}
