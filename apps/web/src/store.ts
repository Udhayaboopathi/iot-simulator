import { create } from "zustand";
import type { Project, ComponentInstance, Wire } from "../../../packages/project-schema/src/index.ts";
import { parseProject, serializeProject } from "../../../packages/project-schema/src/index.ts";
import { History } from "../../../packages/circuit-core/src/index.ts";
import { Simulation } from "../../../packages/simulation-core/src/index.ts";
import { getDef } from "../../../packages/components-library/src/index.ts";
import { uid, snap } from "../../../packages/shared/src/index.ts";

export type ViewMode = "2d" | "3d" | "split";
interface Store {
  project: Project;
  history: History<Project>;
  sim: Simulation;
  running: boolean;
  speed: number;
  view: ViewMode;
  selected: string | null;
  toast: string | null;
  canUndo: boolean; canRedo: boolean;
  load: (p: Project) => void;
  commit: (p: Project) => void;
  undo: () => void; redo: () => void;
  addComponent: (type: string) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  rotateSelected: () => void;
  deleteSelected: () => void;
  addWire: (from: { component: string; pin: string }, to: { component: string; pin: string }) => void;
  removeWire: (id: string) => void;
  setProp: (id: string, key: string, value: string | number | boolean, live?: boolean) => void;
  setCode: (code: string) => void;
  setSelected: (id: string | null) => void;
  setView: (v: ViewMode) => void;
  setSpeed: (s: number) => void;
  run: () => void; pauseSim: () => void; stopSim: () => void;
  showToast: (t: string) => void;
  syncSim: () => void;
}
function freshSim(p: Project): Simulation {
  const sim = new Simulation(p);
  const code = p.files[0]?.content ?? "";
  if (code) { try { sim.loadFirmware(code); } catch { /* diagnostics surfaced in workspace */ } }
  return sim;
}
const blank: Project = {
  schemaVersion: 1, id: "untitled", name: "Untitled Project", description: "", board: "arduino-uno",
  components: [{ id: "uno1", type: "arduino-uno", label: "uno1", pos2d: { x: 60, y: 60 }, pos3d: { x: 60, y: 0, z: 60 }, rotation: 0, props: {} }],
  wires: [], files: [{ name: "sketch.ino", language: "cpp", content: "void setup() {\n  pinMode(D13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(D13, HIGH);\n  delay(500);\n  digitalWrite(D13, LOW);\n  delay(500);\n}\n" }],
  settings: { gridSize: 10, supplyVoltage: 5 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
export const useStore = create<Store>((set, get) => ({
  project: blank,
  history: new History(blank),
  sim: freshSim(blank),
  running: false, speed: 1, view: "split", selected: null, toast: null, canUndo: false, canRedo: false,
  showToast: (t) => { set({ toast: t }); setTimeout(() => { if (get().toast === t) set({ toast: null }); }, 3200); },
  load: (p) => {
    const h = new History(p);
    set({ project: p, history: h, sim: freshSim(p), running: false, selected: null, canUndo: false, canRedo: false });
  },
  commit: (p) => {
    const h = get().history; h.push(p);
    set({ project: p, canUndo: h.canUndo, canRedo: h.canRedo });
    get().syncSim();
  },
  undo: () => { const h = get().history; const p = h.undo(); set({ project: p, sim: freshSim(p), running: false, canUndo: h.canUndo, canRedo: h.canRedo }); },
  redo: () => { const h = get().history; const p = h.redo(); set({ project: p, sim: freshSim(p), running: false, canUndo: h.canUndo, canRedo: h.canRedo }); },
  syncSim: () => {
    // keep the running simulation bound to the same (mutated-by-reference is avoided: projects are immutable) project object
    const { sim, project, running } = get();
    const next = freshSim(project);
    next.timeMs = sim.timeMs; next.events = sim.events;
    if (running) next.start();
    set({ sim: next });
  },
  addComponent: (type) => {
    const p = get().project; const def = getDef(type);
    const base = type.replace(/[^a-z0-9]/gi, "");
    let i = 1; while (p.components.some((c) => c.id === `${base}${i}`)) i++;
    const id = `${base}${i}`;
    const x = 320 + (p.components.length % 4) * 40, y = 120 + (p.components.length % 3) * 60;
    const inst: ComponentInstance = { id, type, label: id, pos2d: { x, y }, pos3d: { x, y: 0, z: y }, rotation: 0, props: { ...def.defaultProps } };
    get().commit({ ...p, components: [...p.components, inst], updatedAt: new Date().toISOString() });
    set({ selected: id });
  },
  moveComponent: (id, x, y) => {
    const p = get().project;
    const nx = snap(x), ny = snap(y);
    const comps = p.components.map((c) => (c.id === id ? { ...c, pos2d: { x: nx, y: ny }, pos3d: { x: nx, y: 0, z: ny } } : c));
    // live move without history spam: update present directly, history pushed on drag end via commitMoveEnd
    get().history.present = { ...p, components: comps };
    set({ project: get().history.present });
    get().syncSim();
  },
  rotateSelected: () => {
    const { project, selected } = get(); if (!selected) return;
    get().commit({ ...project, components: project.components.map((c) => (c.id === selected ? { ...c, rotation: (c.rotation + 90) % 360 } : c)) });
  },
  deleteSelected: () => {
    const { project, selected } = get(); if (!selected) return;
    get().commit({ ...project, components: project.components.filter((c) => c.id !== selected), wires: project.wires.filter((w) => w.from.component !== selected && w.to.component !== selected) });
    set({ selected: null });
  },
  addWire: (from, to) => {
    if (from.component === to.component && from.pin === to.pin) return;
    const p = get().project;
    const colors = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#222222", "#ffffff"];
    const wire: Wire = { id: uid("w"), from, to, color: colors[p.wires.length % colors.length] };
    get().commit({ ...p, wires: [...p.wires, wire] });
  },
  removeWire: (id) => { const p = get().project; get().commit({ ...p, wires: p.wires.filter((w) => w.id !== id) }); },
  setProp: (id, key, value, live = false) => {
    const p = get().project;
    const comps = p.components.map((c) => (c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c));
    if (live) {
      // sensor/input changes during simulation: apply to sim + project without history churn
      get().sim.setProp(id, key, value);
      get().history.present = { ...p, components: comps };
      set({ project: get().history.present });
    } else get().commit({ ...p, components: comps });
  },
  setCode: (code) => {
    const p = get().project;
    const files = p.files.length ? [{ ...p.files[0], content: code }, ...p.files.slice(1)] : [{ name: "sketch.ino", language: "cpp" as const, content: code }];
    get().history.present = { ...p, files };
    set({ project: get().history.present });
    get().syncSim();
  },
  setSelected: (id) => set({ selected: id }),
  setView: (v) => set({ view: v }),
  setSpeed: (s) => set({ speed: s }),
  run: () => { const sim = get().sim; sim.start(); set({ running: true }); },
  pauseSim: () => { get().sim.pause(); set({ running: false }); },
  stopSim: () => { const { project } = get(); const sim = freshSim(project); set({ sim, running: false }); },
}));
export function saveLocal(p: Project) {
  const key = "iot-sim-projects";
  const all = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>;
  all[p.id] = serializeProject(p);
  localStorage.setItem(key, JSON.stringify(all));
  const idx = JSON.parse(localStorage.getItem("iot-sim-index") ?? "[]") as string[];
  if (!idx.includes(p.id)) { idx.unshift(p.id); localStorage.setItem("iot-sim-index", JSON.stringify(idx)); }
}
export function loadLocal(): Project[] {
  const all = JSON.parse(localStorage.getItem("iot-sim-projects") ?? "{}") as Record<string, string>;
  return Object.values(all).map((s) => { try { return parseProject(s); } catch { return null; } }).filter(Boolean) as Project[];
}
