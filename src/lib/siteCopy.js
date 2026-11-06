const DEFAULT_TAGLINE = "Engines sourced to order, delivered across Zimbabwe";

export function withLocalMechanicFitting(tagline) {
  const copy = tagline?.trim() || DEFAULT_TAGLINE;
  const alreadyIncludesService =
    /\boptional\b/i.test(copy) &&
    /\b(fit|fitting|mount|mounting)\b/i.test(copy) &&
    /\bmechanic/i.test(copy) &&
    /\b(zimbabwe|zim)\b/i.test(copy);

  if (alreadyIncludesService) return copy;
  return `${copy.replace(/[.!?]+$/, "")}, with optional fitting by our Zimbabwe mechanics.`;
}
