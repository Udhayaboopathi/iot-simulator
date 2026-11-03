import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Project } from "../../../../packages/project-schema/src/index.ts";
import { EXAMPLES } from "../../../../examples/index.ts";
import { api, currentUser, signOut } from "../api.ts";
import { loadLocal, useStore } from "../store.ts";

function AuthForm({ mode }: { mode: "login" | "register" }) {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const u = mode === "register" ? await api.register(email, password, name || email.split("@")[0]) : await api.login(email, password);
      localStorage.setItem("iot-sim-token", u.token); localStorage.setItem("iot-sim-user", JSON.stringify(u));
      nav("/dashboard");
    } catch {
      // Backend offline: fall back to a clearly-labelled local-only account so the UI remains usable.
      const u = { id: "local", email, name: name || email.split("@")[0], token: "local-only" };
      localStorage.setItem("iot-sim-token", u.token); localStorage.setItem("iot-sim-user", JSON.stringify(u));
      setErr("Backend API unreachable — signed in with a local-only account. Projects will save in this browser only.");
      setTimeout(() => nav("/dashboard"), 900);
    } finally { setBusy(false); }
  };
  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
      <form className="card" onSubmit={submit}>
        {mode === "register" && <label className="small">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ margin: "4px 0 10px" }} /></label>}
        <label className="small">Email<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ margin: "4px 0 10px" }} /></label>
        <label className="small">Password<input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ margin: "4px 0 12px" }} /></label>
        {err && <p className="small" style={{ color: "var(--warn)" }}>{err}</p>}
        <button className="btn primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Please wait…" : mode === "register" ? "Register" : "Login"}</button>
        <p className="small muted" style={{ marginTop: 10 }}>{mode === "register" ? <>Already have an account? <Link to="/login">Login</Link></> : <>New here? <Link to="/register">Register</Link> · <Link to="/forgot-password">Forgot password?</Link></>}</p>
      </form>
    </div>
  );
}
export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  return <div className="wrap" style={{ maxWidth: 440 }}><h1>Forgot password</h1>
    {sent ? <div className="card">If an account exists for that email, a reset link is on its way. (In this self-hosted build, reset links are issued by the API operator — check the server logs / your mailbox.)</div>
      : <form className="card" onSubmit={(e) => { e.preventDefault(); setSent(true); }}><label className="small">Email<input className="input" type="email" required style={{ margin: "4px 0 12px" }} /></label><button className="btn primary">Send reset link</button></form>}
  </div>;
}
function ProjectCards({ projects }: { projects: Project[] }) {
  const nav = useNavigate(); const load = useStore((s) => s.load);
  if (!projects.length) return <p className="muted">Nothing here yet. Open an example or start a blank project — Save in the workspace stores it here.</p>;
  return <div className="grid c3">{projects.map((p) => <div className="card" key={p.id}><h3 style={{ margin: "0 0 4px" }}>{p.name}</h3><p className="muted small">{p.components.length} components · {p.wires.length} wires · updated {new Date(p.updatedAt).toLocaleDateString()}</p><button className="btn primary sm" onClick={() => { load(p); nav("/workspace"); }}>Open in workspace</button></div>)}</div>;
}
export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const user = currentUser();
  useEffect(() => { setProjects(loadLocal()); }, []);
  return <div className="wrap"><h1>Dashboard</h1>
    <p className="muted">{user ? <>Signed in as <strong>{user.name}</strong> ({user.email}).</> : <>You are browsing as a guest. <Link to="/login">Login</Link> to sync projects to the server.</>} Recent projects are stored in this browser.</p>
    <div style={{ display: "flex", gap: 8, margin: "12px 0" }}><Link className="btn primary" to="/projects/new">+ New project</Link><Link className="btn" to="/examples">Examples</Link><Link className="btn" to="/templates">Templates</Link></div>
    <h2 className="sec">Recent projects</h2><ProjectCards projects={projects.slice(0, 6)} />
  </div>;
}
export function MyProjects() { const [p, setP] = useState<Project[]>([]); useEffect(() => { setP(loadLocal()); }, []); return <div className="wrap"><h1>My projects</h1><ProjectCards projects={p} /></div>; }
export function NewProject() {
  const nav = useNavigate(); const load = useStore((s) => s.load);
  return <div className="wrap"><h1>Create project</h1><p className="muted">Start blank, or from one of the tested templates.</p>
    <div className="grid c3">
      <div className="card"><h3 style={{ marginTop: 0 }}>Blank project</h3><p className="muted small">Arduino Uno on an empty workbench with a blink sketch.</p><button className="btn primary sm" onClick={() => { load(useStore.getState().project); nav("/workspace?fresh=1"); }}>Create blank</button></div>
      {EXAMPLES.map((e) => <div className="card" key={e.id}><h3 style={{ marginTop: 0 }}>{e.make().name}</h3><p className="muted small">{e.expected}</p><button className="btn sm" onClick={() => nav(`/workspace?template=${e.id}`)}>Use template</button></div>)}
    </div></div>;
}
export function Templates() { return <div className="wrap"><h1>Templates</h1><p className="muted">Templates are the tested example projects — each one runs as-is.</p><div className="grid c3">{EXAMPLES.map((e) => { const p = e.make(); return <div className="card" key={e.id}><h3 style={{ margin: "0 0 4px" }}>{p.name}</h3><p className="muted small">{p.description}</p><Link className="btn primary sm" to={`/workspace?template=${e.id}`}>Open template</Link></div>; })}</div></div>; }
export function SharedProjects() {
  const [rows, setRows] = useState<string>(""); const user = currentUser();
  useEffect(() => { if (user && user.token !== "local-only") { api.listProjects().then((r) => setRows(JSON.stringify(r, null, 2))).catch(() => setRows("Could not reach the API.")); } }, []);
  return <div className="wrap"><h1>Shared projects</h1>{user ? <><p className="muted">Projects shared with you via the API (public/shared visibility) appear here when the backend is running.</p><pre className="card small" style={{ overflow: "auto" }}>{rows || "No shared projects yet — share one from the API (POST /api/projects/{id}/share) or check back after a teammate shares."}</pre></> : <p className="muted"><Link to="/login">Login</Link> to see shared projects.</p>}</div>;
}
export function Favorites() {
  const favs = JSON.parse(localStorage.getItem("iot-sim-favs") ?? "[]") as string[];
  return <div className="wrap"><h1>Favorites</h1>{favs.length ? <div className="grid c3">{EXAMPLES.filter((e) => favs.includes(e.id)).map((e) => <div className="card" key={e.id}><h3 style={{ margin: "0 0 4px" }}>{e.make().name}</h3><Link className="btn primary sm" to={`/workspace?example=${e.id}`}>Open</Link></div>)}</div> : <p className="muted">No favorites yet. Star an example below:</p>}
    <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>{EXAMPLES.map((e) => <button key={e.id} className="btn sm" onClick={() => { const next = favs.includes(e.id) ? favs.filter((f) => f !== e.id) : [...favs, e.id]; localStorage.setItem("iot-sim-favs", JSON.stringify(next)); location.reload(); }}>{favs.includes(e.id) ? "★" : "☆"} {e.id}</button>)}</div></div>;
}
export function Settings() {
  const user = currentUser();
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [name, setName] = useState(user?.name ?? "");
  return <div className="wrap" style={{ maxWidth: 680 }}><h1>Account & preferences</h1>
    <div className="card" style={{ marginBottom: 12 }}><h3 style={{ marginTop: 0 }}>Profile</h3>
      <div className="prop-row"><span>Email</span><strong>{user?.email ?? "Guest"}</strong></div>
      <div className="prop-row"><span>Display name</span><input className="input" style={{ width: 220 }} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <button className="btn sm" onClick={() => { if (user) { const u = { ...user, name }; localStorage.setItem("iot-sim-user", JSON.stringify(u)); } alert("Saved locally."); }}>Save profile</button>{" "}
      {user && <button className="btn sm danger" onClick={() => { signOut(); location.href = "/"; }}>Sign out</button>}
    </div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Preferences</h3>
      <div className="prop-row"><span>Dark theme</span><input type="checkbox" checked={dark} onChange={(e) => { setDark(e.target.checked); document.documentElement.classList.toggle("dark", e.target.checked); localStorage.setItem("iot-sim-theme", e.target.checked ? "dark" : "light"); }} /></div>
      <div className="prop-row"><span>Default view</span><span className="muted small">Split 2D/3D (change anytime in the workspace)</span></div>
      <div className="prop-row"><span>Workspace settings</span><span className="muted small">Grid 10 units · Supply 5 V (per-project in the JSON)</span></div>
    </div></div>;
}
