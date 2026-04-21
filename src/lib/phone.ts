/** Normalize Kenyan phone numbers to local 07xxxxxxxx form for use as a stable user key. */
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return "0" + digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) return "0" + digits;
  return digits;
}

/** Convert any local format to PayHero-friendly 2547xxxxxxxx. */
export function toMsisdn(input: string): string {
  const local = normalizePhone(input);
  if (local.startsWith("0") && local.length === 10) return "254" + local.slice(1);
  return local;
}

export function isValidKePhone(input: string): boolean {
  const local = normalizePhone(input);
  return /^0(7|1)\d{8}$/.test(local);
}
