import type { Project, Wire } from "@iot-sim/project-schema";
import { getDef } from "@iot-sim/components-library";

export const pinKey = (component: string, pin: string) => `${component}:${pin}`;

/** Union-Find over pin keys -> electrical nets. Wires are real connectivity, not decoration. */
export function buildNets(project: Project): Map<string, string[]> {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let cur = k;
    while (parent.get(cur) !== r) { const n = parent.get(cur)!; parent.set(cur, r); cur = n; }
    return r;
  };
  const ensure = (k: string) => { if (!parent.has(k)) parent.set(k, k); };
  const union = (a: string, b: string) => { ensure(a); ensure(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const c of project.components) {
    const def = getDef(c.type);
    for (const p of def.pins) ensure(pinKey(c.id, p.id));
    // internal pass-throughs
    if (def.behavior === "breadboard") { /* rails handled by explicit wires in projects */ }
    if (def.behavior === "button") { union(pinKey(c.id, "1"), pinKey(c.id, "3")); union(pinKey(c.id, "2"), pinKey(c.id, "4")); if (c.props.pressed) { union(pinKey(c.id, "1"), pinKey(c.id, "2")); } }
    if (def.behavior === "switch") { if (c.props.on) union(pinKey(c.id, "COM"), pinKey(c.id, "1")); else union(pinKey(c.id, "COM"), pinKey(c.id, "2")); }
    if (def.behavior === "relay") { if (c.props.energised) union(pinKey(c.id, "COM"), pinKey(c.id, "NO")); else union(pinKey(c.id, "COM"), pinKey(c.id, "NC")); }
  }
  for (const w of project.wires) union(pinKey(w.from.component, w.from.pin), pinKey(w.to.component, w.to.pin));
  const nets = new Map<string, string[]>();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!nets.has(r)) nets.set(r, []);
    nets.get(r)!.push(k);
  }
  return nets;
}
export function netOf(project: Project, component: string, pin: string): string[] {
  const nets = buildNets(project);
  const key = pinKey(component, pin);
  for (const members of nets.values()) if (members.includes(key)) return members;
  return [key];
}
export function areConnected(project: Project, a: { component: string; pin: string }, b: { component: string; pin: string }): boolean {
  return netOf(project, a.component, a.pin).includes(pinKey(b.component, b.pin));
}
/** Netlist: human-readable + solver-ready list of nets with their pins. */
export function generateNetlist(project: Project): { name: string; pins: string[] }[] {
  const nets = buildNets(project);
  return [...nets.values()].filter((m) => m.length > 1).map((pins, i) => ({ name: `NET${i + 1}`, pins: [...pins].sort() }));
}
export function validateCircuit(project: Project): string[] {
  const warnings: string[] = [];
  const nets = buildNets(project);
  const netList = [...nets.values()];
  const has = (members: string[], suffix: string) => members.some((m) => m.endsWith(suffix));
  for (const members of netList) {
    if (has(members, ":5V") && has(members, ":GND")) warnings.push("Short circuit: 5V net is connected to GND");
    if (has(members, ":VCC") && has(members, ":GND") && members.length > 2 && has(members, ":5V")) warnings.push("Possible short: supply pins share a net with GND");
  }
  for (const c of project.components) {
    const def = getDef(c.type);
    if (def.behavior === "led") {
      const aNet = netOf(project, c.id, "A");
      const drivenDirectly = aNet.some((m) => /^[a-z0-9-]+:D\d+$/i.test(m) || m.includes(":GPIO"));
      const hasResistor = project.components.some((o) => getDef(o.type).behavior === "resistor" && (areConnected(project, { component: o.id, pin: "1" }, { component: c.id, pin: "A" }) || areConnected(project, { component: o.id, pin: "2" }, { component: c.id, pin: "A" }) || areConnected(project, { component: o.id, pin: "1" }, { component: c.id, pin: "K" }) || areConnected(project, { component: o.id, pin: "2" }, { component: c.id, pin: "K" })));
      if (drivenDirectly && !hasResistor) warnings.push(`LED ${c.label} is driven directly with no current-limiting resistor in its nets`);
    }
  }
  return warnings;
}
export function addWire(project: Project, wire: Wire): Project {
  if (wire.from.component === wire.to.component && wire.from.pin === wire.to.pin) throw new Error("Cannot wire a pin to itself");
  return { ...project, wires: [...project.wires, wire], updatedAt: new Date().toISOString() };
}
export function removeWire(project: Project, wireId: string): Project {
  return { ...project, wires: project.wires.filter((w) => w.id !== wireId), updatedAt: new Date().toISOString() };
}

/** Undo/redo history over immutable project snapshots. */
export class History<T> {
  private past: T[] = []; private future: T[] = [];
  constructor(public present: T, private limit = 100) {}
  push(next: T) { this.past.push(this.present); if (this.past.length > this.limit) this.past.shift(); this.present = next; this.future = []; }
  undo(): T { if (this.past.length) { this.future.unshift(this.present); this.present = this.past.pop()!; } return this.present; }
  redo(): T { if (this.future.length) { this.past.push(this.present); this.present = this.future.shift()!; } return this.present; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
