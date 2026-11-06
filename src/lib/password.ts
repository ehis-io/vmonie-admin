/** Why a new staff password cannot be used yet, or null. Matches the API's 12-200. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}
