/**
 * Project schema — the single source of truth shared by the 2D editor,
 * the 3D editor, the simulation engines and the backend.
 * One circuit graph, two views. There is no second netlist.
 */
export const SCHEMA_VERSION = 1;

export type PinKind = "power" | "ground" | "digital" | "analog" | "pwm" | "i2c" | "spi" | "uart" | "passive";
export interface PinDef {
  id: string;            // e.g. "D13", "A0", "VCC", "GND", "A" (anode)
  label: string;
  kind: PinKind;
  /** offset from component origin, in 2D grid units */
  x: number; y: number;
}
export interface ComponentInstance {
  id: string;            // deterministic instance id, e.g. "uno1", "led1"
  type: string;          // component definition id, e.g. "arduino-uno"
  label: string;
  pos2d: { x: number; y: number };
  pos3d: { x: number; y: number; z: number };
  rotation: number;      // degrees, 2D (3D uses Y rotation = same value)
  props: Record<string, string | number | boolean>;
}
export interface Wire {
  id: string;
  from: { component: string; pin: string };
  to: { component: string; pin: string };
  color: string;
  /** optional mid-points for 2D routing */
  points?: { x: number; y: number }[];
}
export interface SourceFile { name: string; language: "cpp" | "python" | "json"; content: string; }
export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  board: string;                       // primary MCU component type
  components: ComponentInstance[];
  wires: Wire[];
  files: SourceFile[];
  settings: { gridSize: number; supplyVoltage: number };
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue { level: "error" | "warning"; message: string; component?: string; }

export function validateProject(p: unknown): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (typeof p !== "object" || p === null) return { ok: false, issues: [{ level: "error", message: "Project is not an object" }] };
  const pr = p as Partial<Project>;
  if (pr.schemaVersion !== SCHEMA_VERSION) issues.push({ level: "error", message: `Unsupported schemaVersion ${String(pr.schemaVersion)} (expected ${SCHEMA_VERSION})` });
  if (!pr.id) issues.push({ level: "error", message: "Missing project id" });
  if (!pr.name) issues.push({ level: "error", message: "Missing project name" });
  if (!Array.isArray(pr.components)) issues.push({ level: "error", message: "components must be an array" });
  if (!Array.isArray(pr.wires)) issues.push({ level: "error", message: "wires must be an array" });
  if (Array.isArray(pr.components)) {
    const ids = new Set<string>();
    for (const c of pr.components) {
      if (ids.has(c.id)) issues.push({ level: "error", message: `Duplicate component id ${c.id}`, component: c.id });
      ids.add(c.id);
    }
    if (Array.isArray(pr.wires)) {
      for (const w of pr.wires) {
        if (!ids.has(w.from.component)) issues.push({ level: "error", message: `Wire ${w.id} starts at unknown component ${w.from.component}` });
        if (!ids.has(w.to.component)) issues.push({ level: "error", message: `Wire ${w.id} ends at unknown component ${w.to.component}` });
      }
    }
  }
  return { ok: !issues.some((i) => i.level === "error"), issues };
}

export function serializeProject(p: Project): string { return JSON.stringify(p, null, 2); }
export function parseProject(json: string): Project {
  const raw = JSON.parse(json) as Project;
  const v = validateProject(raw);
  if (!v.ok) throw new Error("Invalid project: " + v.issues.filter((i) => i.level === "error").map((i) => i.message).join("; "));
  return migrateProject(raw);
}
/** Schema migrations: v1 is current; older/unknown fields are normalised here. */
export function migrateProject(p: Project): Project {
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    settings: { gridSize: p.settings?.gridSize ?? 10, supplyVoltage: p.settings?.supplyVoltage ?? 5 },
    files: p.files ?? [],
    components: (p.components ?? []).map((c) => ({ ...c, props: c.props ?? {}, rotation: c.rotation ?? 0, pos3d: c.pos3d ?? { x: c.pos2d.x, y: 0, z: c.pos2d.y } })),
    wires: p.wires ?? [],
  };
}
export function emptyProject(id: string, name: string): Project {
  const now = new Date().toISOString();
  return { schemaVersion: SCHEMA_VERSION, id, name, description: "", board: "arduino-uno", components: [], wires: [], files: [{ name: "sketch.ino", language: "cpp", content: "void setup() {}\nvoid loop() {}\n" }], settings: { gridSize: 10, supplyVoltage: 5 }, createdAt: now, updatedAt: now };
}
