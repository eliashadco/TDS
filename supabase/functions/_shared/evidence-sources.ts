/** Canon §8.4 — allowed evidence source_label values (trade_evidence_records). */
export const EVIDENCE_SOURCE_WHITELIST = new Set([
  "polygon",
  "yahoo",
  "reuters",
  "sec_edgar",
  "company_ir",
]);

export function isWhitelistedEvidenceSource(sourceLabel: string): boolean {
  return EVIDENCE_SOURCE_WHITELIST.has(sourceLabel.trim().toLowerCase());
}
