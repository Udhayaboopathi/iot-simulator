const BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL ?? "http://127.0.0.1:8000";
export interface ApiUser { id: string; email: string; name: string; token: string; }
async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("iot-sim-token");
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
export const api = {
  health: () => req<{ status: string }>("/health"),
  register: (email: string, password: string, name: string) => req<ApiUser>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) => req<ApiUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  listProjects: () => req<unknown[]>("/api/projects"),
  createProject: (name: string, data: unknown) => req<unknown>("/api/projects", { method: "POST", body: JSON.stringify({ name, data }) }),
};
export function currentUser(): ApiUser | null {
  try { return JSON.parse(localStorage.getItem("iot-sim-user") ?? "null") as ApiUser | null; } catch { return null; }
}
export function signOut() { localStorage.removeItem("iot-sim-token"); localStorage.removeItem("iot-sim-user"); }
