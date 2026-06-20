export function looksLikeCivicAddress(value: string): boolean {
  const query = value.trim();
  return /\d/.test(query) && /[a-zA-ZÀ-ÿ]/.test(query) && query.length >= 5;
}
