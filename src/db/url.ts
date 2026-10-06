// Connection strings live in env without the password; DB_PASSWORD is added
// here (URL-encoded, so special characters are safe). A password already in
// the URL is kept.
export function databaseUrl(kind: "app" | "migrations" = "app"): string {
  const raw = kind === "migrations" ? (process.env.DIRECT_URL ?? process.env.DATABASE_URL) : process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  const url = new URL(raw);
  const password = process.env.DB_PASSWORD;
  if (password && !url.password) url.password = password;
  return url.toString();
}
