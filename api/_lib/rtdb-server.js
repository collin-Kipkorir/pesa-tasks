const DB_URL = "https://surveys-2791f-default-rtdb.firebaseio.com";

function withAuth(path) {
  const secret = process.env.FIREBASE_DB_SECRET;
  const url = `${DB_URL}/${path}.json`;
  return secret ? `${url}?auth=${encodeURIComponent(secret)}` : url;
}

export async function rtdbSet(path, value) {
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

export async function rtdbUpdate(path, patch) {
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

export async function rtdbGet(path) {
  const res = await fetch(withAuth(path));
  if (!res.ok) return null;
  return await res.json();
}
