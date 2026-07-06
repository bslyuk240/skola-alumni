export async function fetchJson<T = unknown>(
  url: string,
  options: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = { method: "GET" }
): Promise<T> {
  const response = await fetch(url, {
    method: options.method,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request to ${url} failed`);
  }

  return response.json();
}
