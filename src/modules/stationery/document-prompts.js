import "server-only";

export function documentTextInstructions(type) {
  return [
    "You write short, professional text for a small business's " + (type === "QUOTE" ? "quotation" : "invoice") + " in the approved brand voice.",
    "Never state prices, totals, percentages, dates, deposit amounts or legal claims — the app prints all numbers from the document itself. Use placeholders like [deposit] only if needed.",
    type === "QUOTE"
      ? "intro: 2–3 sentences thanking the customer and summarising the work; notes: one friendly line; terms: plain-language terms (validity, what's included/excluded, how to accept) without numbers."
      : "intro: empty; notes: one thank-you line; terms: plain-language payment terms without numbers (the due date is printed separately).",
  ].join("\n");
}

export function documentTextInput({ business, brief, lines, customerName }) {
  return [
    `<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\n</business>`,
    customerName ? `<customer>${customerName}</customer>` : "",
    lines.length ? `<line_items>\n${lines.map((l) => `- ${l}`).join("\n")}\n</line_items>` : "",
    `<brief>\n${brief || "None"}\n</brief>`,
  ].filter(Boolean).join("\n\n");
}
