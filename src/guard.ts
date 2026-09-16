// Guardrails: the answer may only cite chunks that were actually retrieved,
// and we abstain instead of answering when retrieval confidence is low.

export const DEFAULT_MIN_CONFIDENCE = Number(process.env.RECALL_MIN_CONFIDENCE ?? 0.35);

export const ABSTAIN_TEXT = "I don't have notes that answer this.";

export function checkCitations(citations: string[], retrievedIds: string[]): { valid: boolean; invalid: string[] } {
  const allowed = new Set(retrievedIds);
  const invalid = citations.filter((c) => !allowed.has(c));
  return { valid: citations.length > 0 && invalid.length === 0, invalid };
}

export function shouldAbstain(confidence: number, minConfidence = DEFAULT_MIN_CONFIDENCE): boolean {
  return confidence < minConfidence;
}
