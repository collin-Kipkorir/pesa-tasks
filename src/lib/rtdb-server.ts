// Server-side Firebase Realtime DB writer using the REST API.
// The Worker runtime can't easily run firebase-admin, but the RTDB REST API works
// with simple fetch calls. We authenticate using a Firebase database secret
// (FIREBASE_DB_SECRET) so the database rules can deny client writes to /payments
// while still allowing trusted server writes.

const DB_URL = "https://surveys-2791f-default-rtdb.firebaseio.com";

function withAuth(path: string): string {
  const secret = process.env.FIREBASE_DB_SECRET;
  const url = `${DB_URL}/${path}.json`;
  return secret ? `${url}?auth=${encodeURIComponent(secret)}` : url;
}

export async function rtdbSet(path: string, value: unknown): Promise<void> {
  const res = await fetch(withAuth(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RTDB set ${path} failed: ${res.status} ${text}`);
  }
}

export async function rtdbUpdate(path: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(withAuth(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RTDB update ${path} failed: ${res.status} ${text}`);
  }
}

export async function rtdbGet<T = unknown>(path: string): Promise<T | null> {
  const res = await fetch(withAuth(path));
  if (!res.ok) return null;
  return (await res.json()) as T;
}
