// Server-side Firebase Realtime DB writer using the REST API.
// The Worker runtime can't easily run firebase-admin, but the RTDB REST API works
// with simple fetch calls. Database rules should allow writes to /payments.

const DB_URL = "https://surveys-2791f-default-rtdb.firebaseio.com";

export async function rtdbSet(path: string, value: unknown): Promise<void> {
  const res = await fetch(`${DB_URL}/${path}.json`, {
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
  const res = await fetch(`${DB_URL}/${path}.json`, {
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
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) return null;
  return (await res.json()) as T;
}
