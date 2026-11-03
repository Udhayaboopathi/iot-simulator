import type { Project } from "@iot-sim/project-schema";
import { getDef } from "@iot-sim/components-library";
import { buildNets, pinKey } from "@iot-sim/circuit-core";

/* ================= Analog solver (Modified Nodal Analysis) ================= */
export interface AnalogSolution { nodeVoltage: Map<string, number>; branchCurrent: Map<string, number>; }
interface VSource { id: string; plus: string; minus: string; volts: number; seriesR?: number; }
interface ResistorEl { a: string; b: string; r: number; id?: string; }

/** Solve a linear DC circuit: resistors + ideal voltage sources (MNA). Ground net key = "GND". */
export function solveAnalog(nodes: string[], resistors: ResistorEl[], sources: VSource[], ground = "GND"): AnalogSolution {
  const nodeIndex = new Map<string, number>();
  const freeNodes = nodes.filter((n) => n !== ground);
  freeNodes.forEach((n, i) => nodeIndex.set(n, i));
  const n = freeNodes.length, m = sources.length, N = n + m;
  const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const z: number[] = new Array(N).fill(0);
  const stampR = (a: string, b: string, r: number) => {
    const g = 1 / Math.max(r, 1e-6);
    const ia = nodeIndex.get(a), ib = nodeIndex.get(b);
    if (ia !== undefined) A[ia][ia] += g;
    if (ib !== undefined) A[ib][ib] += g;
    if (ia !== undefined && ib !== undefined) { A[ia][ib] -= g; A[ib][ia] -= g; }
  };
  for (const r of resistors) stampR(r.a, r.b, r.r);
  sources.forEach((s, j) => {
    const row = n + j;
    const ip = nodeIndex.get(s.plus), im = nodeIndex.get(s.minus);
    if (ip !== undefined) { A[ip][row] += 1; A[row][ip] += 1; }
    if (im !== undefined) { A[im][row] -= 1; A[row][im] -= 1; }
    z[row] = s.volts;
  });
  // Gaussian elimination with partial pivoting
  const x = new Array(N).fill(0);
  const M = A.map((row, i) => [...row, z[i]]);
  for (let col = 0, row = 0; col < N && row < N; col++, row++) {
    let piv = row; for (let i = row + 1; i < N; i++) if (Math.abs(M[i][col]) > Math.abs(M[piv][col])) piv = i;
    if (Math.abs(M[piv][col]) < 1e-12) { M[row][col] = 1e-12; }
    [M[row], M[piv]] = [M[piv], M[row]];
    const d = M[row][col];
    for (let j = col; j <= N; j++) M[row][j] /= d;
    for (let i = 0; i < N; i++) { if (i !== row && M[i][col] !== 0) { const f = M[i][col]; for (let j = col; j <= N; j++) M[i][j] -= f * M[row][j]; } }
  }
  // After full Gauss-Jordan reduction each row i holds variable i's value in the RHS column.
  for (let i = 0; i < N; i++) x[i] = M[i][N];
  const nodeVoltage = new Map<string, number>([[ground, 0]]);
  freeNodes.forEach((node, i) => nodeVoltage.set(node, x[i] ?? 0));
  const branchCurrent = new Map<string, number>();
  sources.forEach((s, j) => branchCurrent.set(s.id, x[n + j] ?? 0));
  return { nodeVoltage, branchCurrent };
}
/** RC charge helper (transient): capacitor voltage after t seconds. */
export function rcCharge(v0: number, vTarget: number, r: number, cFarad: number, tSec: number): number {
  return vTarget + (v0 - vTarget) * Math.exp(-tSec / (r * cFarad));
}
export const ledCurrent = (vSupply: number, vf: number, r: number) => Math.max(0, (vSupply - vf) / r);
export const voltageDivider = (vin: number, rTop: number, rBottom: number) => (vin * rBottom) / (rTop + rBottom);

/* ================= Sketch VM (Arduino subset, generator-based) ================= */
type Val = number | string | boolean;
interface Callbacks {
  pinMode(pin: string, mode: string): void;
  digitalWrite(pin: string, high: boolean): void;
  analogWrite(pin: string, duty: number): void;
  digitalRead(pin: string): boolean;
  analogRead(pin: string): number;
  serial(text: string): void;
  servoWrite(pin: string, angle: number): void;
  lcdPrint(text: string, clear: boolean): void;
  sensorRead(kind: "temperature" | "humidity" | "distance", pin: string): number;
  mqttPublish(topic: string, payload: string): void;
  millis(): number;
}
const HIGH: Val = 1, LOW: Val = 0;
function tokenize(code: string): string[] {
  const cleaned = code.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/#[^\n]*/g, "");
  const tokens: string[] = [];
  const re = /\s*(("(?:[^"\\]|\\.)*")|(\d+\.\d+|\d+)|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|<<|>>|.) )/gy;
  let m: RegExpExecArray | null; let guard = 0;
  const src = cleaned;
  let pos = 0;
  const pattern = /("(?:[^"\\]|\\.)*")|(\d+\.\d+|\d+)|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|<<|>>)|(\S)/y;
  pattern.lastIndex = 0;
  while (pos < src.length && guard++ < 100000) {
    if (/\s/.test(src[pos])) { pos++; continue; }
    pattern.lastIndex = pos;
    m = pattern.exec(src);
    if (!m) break;
    tokens.push(m[0]); pos = pattern.lastIndex;
  }
  void re;
  return tokens;
}
interface Stmt { kind: string; [k: string]: unknown; }
interface FuncDef { params: string[]; body: Stmt[]; }
class Parser {
  private i = 0;
  constructor(private toks: string[]) {}
  private peek(k = 0) { return this.toks[this.i + k]; }
  private next() { return this.toks[this.i++]; }
  private expect(t: string) { const g = this.next(); if (g !== t) throw new Error(`Parse error: expected '${t}' got '${g}'`); }
  private accept(t: string) { if (this.peek() === t) { this.i++; return true; } return false; }
  parseProgram(): Map<string, FuncDef> {
    const funcs = new Map<string, FuncDef>();
    while (this.i < this.toks.length) {
      // [type] name ( params ) { body }   — also handles "Servo myServo;" object decls at top level (skipped; objects are implicit)
      const type = this.next();
      if (type === undefined) break;
      if (this.peek() === ";") { this.i++; continue; }
      const name = this.next();
      if (this.peek() === "(") {
        this.i++;
        const params: string[] = [];
        while (this.peek() !== ")" && this.i < this.toks.length) { const p = this.next(); if (p !== "," && !["int", "float", "long", "bool", "boolean", "String", "void", "unsigned", "char", "double"].includes(p)) params.push(p); if (this.peek() === ",") this.i++; }
        this.expect(")");
        if (this.accept(";")) { funcs.set(name, { params, body: [] }); continue; } // prototype / object constructor decl
        this.expect("{");
        const body = this.parseBlock();
        funcs.set(name, { params, body });
      } else {
        // global variable or object declaration: skip to ';', but capture simple "type name = expr;"
        const globals: Stmt[] = [];
        if (this.accept("=")) { const expr = this.parseExpr(); globals.push({ kind: "assign", target: name, expr }); }
        while (this.peek() !== ";" && this.i < this.toks.length) this.i++;
        this.accept(";");
        if (globals.length) { const prev = funcs.get("__globals__") ?? { params: [], body: [] }; prev.body.push(...globals); funcs.set("__globals__", prev); }
        void type;
      }
    }
    return funcs;
  }
  private parseBlock(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek() !== "}" && this.i < this.toks.length) stmts.push(this.parseStmt());
    this.expect("}");
    return stmts;
  }
  private parseStmt(): Stmt {
    const t = this.peek();
    if (t === "{") { this.i++; return { kind: "block", body: this.parseBlock() }; }
    if (t === "if") { this.i++; this.expect("("); const cond = this.parseExpr(); this.expect(")"); const then = this.parseStmt(); let els: Stmt | undefined; if (this.peek() === "else") { this.i++; els = this.parseStmt(); } return { kind: "if", cond, then, els }; }
    if (t === "for") {
      this.i++; this.expect("(");
      const init = this.peek() === ";" ? null : this.parseSimpleLine();
      this.accept(";");
      const cond = this.peek() === ";" ? null : this.parseExpr();
      this.accept(";");
      const incr = this.peek() === ")" ? null : this.parseExprOrAssign();
      this.expect(")");
      const body = this.parseStmt();
      return { kind: "for", init, cond, incr, body };
    }
    if (t === "while") { this.i++; this.expect("("); const cond = this.parseExpr(); this.expect(")"); return { kind: "while", cond, body: this.parseStmt() }; }
    if (t === "return") { this.i++; const expr = this.peek() === ";" ? null : this.parseExpr(); this.accept(";"); return { kind: "return", expr }; }
    if (t === ";") { this.i++; return { kind: "noop" }; }
    const stmt = this.parseSimpleLine();
    this.accept(";");
    return stmt;
  }
  /** declaration / assignment / expression-statement without the trailing ';' */
  private parseSimpleLine(): Stmt {
    const t = this.peek();
    if (["int", "float", "long", "bool", "boolean", "String", "double", "char", "unsigned", "const"].includes(t)) {
      if (t === "const" || t === "unsigned") this.i++;
      this.i++; // type
      const name = this.next();
      if (this.accept("=")) return { kind: "decl", name, expr: this.parseExpr() };
      if (this.peek() === "(") { // object construction e.g. DHT dht(2, DHT22); -> treat as decl with call expr
        const expr = this.parseExpr(); return { kind: "decl", name, expr };
      }
      return { kind: "decl", name, expr: null };
    }
    return this.parseExprOrAssign();
  }
  private parseExprOrAssign(): Stmt {
    // look ahead for IDENT (= | += | ...) 
    const name = this.peek();
    const op = this.peek(1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && ["=", "+=", "-=", "*=", "/="].includes(op)) {
      this.i += 2;
      return { kind: "assign", target: name, op, expr: this.parseExpr() };
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && (op === "++" || op === "--")) { this.i += 2; return { kind: "inc", target: name, delta: op === "++" ? 1 : -1 }; }
    return { kind: "expr", expr: this.parseExpr() };
  }
  parseExpr(): unknown { return this.parseOr(); }
  private parseOr(): unknown { let l = this.parseAnd(); while (this.peek() === "||") { this.i++; l = { bin: "||", l, r: this.parseAnd() }; } return l; }
  private parseAnd(): unknown { let l = this.parseCmp(); while (this.peek() === "&&") { this.i++; l = { bin: "&&", l, r: this.parseCmp() }; } return l; }
  private parseCmp(): unknown { let l = this.parseAdd(); while (["==", "!=", "<", ">", "<=", ">="].includes(this.peek())) { const op = this.next(); l = { bin: op, l, r: this.parseAdd() }; } return l; }
  private parseAdd(): unknown { let l = this.parseMul(); while (["+", "-"].includes(this.peek())) { const op = this.next(); l = { bin: op, l, r: this.parseMul() }; } return l; }
  private parseMul(): unknown { let l = this.parseUnary(); while (["*", "/", "%"].includes(this.peek())) { const op = this.next(); l = { bin: op, l, r: this.parseUnary() }; } return l; }
  private parseUnary(): unknown {
    if (this.peek() === "-") { this.i++; return { neg: this.parseUnary() }; }
    if (this.peek() === "!") { this.i++; return { not: this.parseUnary() }; }
    return this.parsePostfix();
  }
  private parsePostfix(): unknown {
    let e = this.parsePrimary();
    for (;;) {
      if (this.peek() === ".") { this.i++; const member = this.next(); // member access or method call
        if (this.peek() === "(") { this.i++; const args = this.parseArgs(); e = { method: member, obj: e, args }; }
        else e = { member, obj: e };
        continue;
      }
      if (this.peek() === "[") { this.i++; const idx = this.parseExpr(); this.expect("]"); e = { index: idx, obj: e }; continue; }
      break;
    }
    return e;
  }
  private parseArgs(): unknown[] {
    const args: unknown[] = [];
    if (this.peek() === ")") { this.i++; return args; }
    for (;;) { args.push(this.parseExpr()); if (this.accept(",")) continue; this.expect(")"); break; }
    return args;
  }
  private parsePrimary(): unknown {
    const t = this.next();
    if (t === undefined) throw new Error("Parse error: unexpected end");
    if (t === "(") { const e = this.parseExpr(); this.expect(")"); return e; }
    if (/^".*"$/.test(t)) return { str: t.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"') };
    if (/^\d/.test(t)) return { num: parseFloat(t) };
    if (this.peek() === "(") { this.i++; const args = this.parseArgs(); return { call: t, args }; }
    return { var: t };
  }
}

/** Incremental Arduino-subset interpreter. Yields on delay() so a UI can run it in real time. */
export class SketchVM {
  private funcs: Map<string, FuncDef>;
  private vars = new Map<string, Val>();
  private gen: Generator<number, void, unknown> | null = null;
  public diagnostics: string[] = [];
  constructor(code: string, private cb: Callbacks) {
    this.funcs = new Parser(tokenize(code)).parseProgram();
    for (const [k, v] of Object.entries({ HIGH, LOW, INPUT: "INPUT", OUTPUT: "OUTPUT", INPUT_PULLUP: "INPUT_PULLUP", LED_BUILTIN: "D13" })) this.vars.set(k, v as Val);
  }
  private pinName(v: Val): string {
    if (typeof v === "string") return v;
    const n = Number(v);
    if (this.vars.has(`__pinmap_${n}`)) return String(this.vars.get(`__pinmap_${n}`));
    return `D${n}`;
  }
  start(): void {
    const self = this;
    this.gen = (function* () {
      yield* self.execBlock(self.funcs.get("__globals__")?.body ?? []);
      yield* self.execFunc("setup", []);
      for (;;) { yield* self.execFunc("loop", []); yield 1; /* one loop pass >= 1ms virtual */ }
    })();
  }
  private pendingDelay = 0;
  /** Advance the virtual clock by up to budgetMs; returns virtual ms actually consumed.
   *  A delay() longer than the budget is partially consumed and resumed next step. */
  step(budgetMs: number): number {
    if (!this.gen) this.start();
    if (this.pendingDelay > 0) {
      const use = Math.min(budgetMs, this.pendingDelay);
      this.pendingDelay -= use;
      return use;
    }
    let consumed = 0;
    while (consumed < budgetMs) {
      const r = this.gen!.next();
      if (r.done) break;
      const v = typeof r.value === "number" ? r.value : 0;
      if (v <= 0) continue;
      if (consumed + v <= budgetMs) { consumed += v; continue; }
      this.pendingDelay = v - (budgetMs - consumed);
      consumed = budgetMs;
      break;
    }
    return consumed;
  }
  private *execFunc(name: string, args: Val[]): Generator<number, Val | undefined, unknown> {
    const f = this.funcs.get(name);
    if (!f) return undefined;
    const saved = new Map<string, Val>();
    f.params.forEach((p, idx) => { saved.set(p, this.vars.get(p) as Val); this.vars.set(p, args[idx] ?? 0); });
    const r = yield* this.execBlock(f.body);
    f.params.forEach((p) => { if (saved.has(p)) this.vars.set(p, saved.get(p)!); else this.vars.delete(p); });
    return r;
  }
  private *execBlock(stmts: Stmt[]): Generator<number, Val | undefined, unknown> {
    for (const s of stmts) { const r = yield* this.execStmt(s); if (r !== undefined && s.kind !== "expr") return r; if ((s as { __returned?: boolean }).__returned) return r; }
    return undefined;
  }
  private *execStmt(s: Stmt): Generator<number, Val | undefined, unknown> {
    switch (s.kind) {
      case "noop": return undefined;
      case "block": return yield* this.execBlock(s.body as Stmt[]);
      case "decl": this.vars.set(s.name as string, s.expr ? (yield* this.evalExpr(s.expr)) as Val : 0); return undefined;
      case "assign": {
        const v = (yield* this.evalExpr(s.expr)) as Val; const cur = Number(this.vars.get(s.target as string) ?? 0);
        const op = (s.op as string) ?? "=";
        this.vars.set(s.target as string, op === "=" ? v : op === "+=" ? cur + Number(v) : op === "-=" ? cur - Number(v) : op === "*=" ? cur * Number(v) : cur / Number(v));
        return undefined;
      }
      case "inc": this.vars.set(s.target as string, Number(this.vars.get(s.target as string) ?? 0) + Number(s.delta)); return undefined;
      case "expr": yield* this.evalExpr(s.expr); return undefined;
      case "return": { const v = s.expr ? (yield* this.evalExpr(s.expr)) as Val : undefined; (s as { __returned?: boolean }).__returned = true; return v; }
      case "if": { const c = yield* this.evalExpr(s.cond); if (truthy(c as Val)) return yield* this.execStmt(s.then as Stmt); if (s.els) return yield* this.execStmt(s.els as Stmt); return undefined; }
      case "for": {
        if (s.init) yield* this.execStmt(s.init as Stmt);
        let guard = 0;
        while (guard++ < 100000) { if (s.cond && !truthy((yield* this.evalExpr(s.cond)) as Val)) break; const r = yield* this.execStmt(s.body as Stmt); if (r !== undefined) return r; if (s.incr) yield* this.execStmt(s.incr as Stmt); }
        return undefined;
      }
      case "while": { let guard = 0; while (guard++ < 100000 && truthy((yield* this.evalExpr(s.cond)) as Val)) { const r = yield* this.execStmt(s.body as Stmt); if (r !== undefined) return r; } return undefined; }
    }
    return undefined;
  }
  private *evalExpr(e: unknown): Generator<number, Val, unknown> {
    const ex = e as Record<string, unknown>;
    if (ex.num !== undefined) return ex.num as number;
    if (ex.str !== undefined) return ex.str as string;
    if (ex.var !== undefined) {
      const name = ex.var as string;
      if (name === "true") return true; if (name === "false") return false;
      if (/^A\d+$/.test(name) || /^D\d+$/.test(name) || /^GPIO\d+$/.test(name) || /^GP\d+$/.test(name)) return name;
      if (name === "DHT22" || name === "DHT11") return name;
      return this.vars.get(name) ?? name; // unknown identifiers resolve to their name (object handles)
    }
    if (ex.neg !== undefined) return -Number(yield* this.evalExpr(ex.neg));
    if (ex.not !== undefined) return !truthy((yield* this.evalExpr(ex.not)) as Val);
    if (ex.bin) {
      const op = ex.bin as string;
      if (op === "&&") { const l = yield* this.evalExpr(ex.l); return truthy(l) && truthy((yield* this.evalExpr(ex.r)) as Val); }
      if (op === "||") { const l = yield* this.evalExpr(ex.l); return truthy(l) || truthy((yield* this.evalExpr(ex.r)) as Val); }
      const l = yield* this.evalExpr(ex.l); const r = yield* this.evalExpr(ex.r);
      switch (op) {
        case "+": return typeof l === "string" || typeof r === "string" ? String(l) + String(r) : Number(l) + Number(r);
        case "-": return Number(l) - Number(r);
        case "*": return Number(l) * Number(r);
        case "/": return Number(l) / Number(r);
        case "%": return Number(l) % Number(r);
        case "==": return l === r || Number(l) === Number(r);
        case "!=": return !(l === r || Number(l) === Number(r));
        case "<": return Number(l) < Number(r); case ">": return Number(l) > Number(r);
        case "<=": return Number(l) <= Number(r); case ">=": return Number(l) >= Number(r);
      }
    }
    if (ex.call) {
      const name = ex.call as string;
      const args: Val[] = []; for (const a of ex.args as unknown[]) args.push((yield* this.evalExpr(a)) as Val);
      switch (name) {
        case "pinMode": this.cb.pinMode(this.pinName(args[0]), String(args[1])); return 0;
        case "digitalWrite": this.cb.digitalWrite(this.pinName(args[0]), truthy(args[1])); return 0;
        case "digitalRead": return this.cb.digitalRead(this.pinName(args[0])) ? 1 : 0;
        case "analogWrite": this.cb.analogWrite(this.pinName(args[0]), Number(args[1])); return 0;
        case "analogRead": return this.cb.analogRead(this.pinName(args[0]));
        case "delay": yield Number(args[0]); return 0;
        case "millis": return this.cb.millis();
        case "pulseIn": return this.cb.sensorRead("distance", this.pinName(args[0])) * 58; // µs echo for cm
        case "map": { const [v, a, b, c, d] = args.map(Number); return c + ((v - a) * (d - c)) / (b - a); }
        case "constrain": return Math.min(Number(args[2]), Math.max(Number(args[1]), Number(args[0])));
        case "abs": return Math.abs(Number(args[0]));
        case "min": return Math.min(Number(args[0]), Number(args[1]));
        case "max": return Math.max(Number(args[0]), Number(args[1]));
        default: { const r = yield* this.execFunc(name, args); return (r ?? 0) as Val; }
      }
    }
    if (ex.method) {
      const objName = typeof ex.obj === "object" && ex.obj !== null && "var" in (ex.obj as Record<string, unknown>) ? String((ex.obj as Record<string, unknown>).var) : String(yield* this.evalExpr(ex.obj));
      const method = ex.method as string;
      const args: Val[] = []; for (const a of (ex.args as unknown[]) ?? []) args.push((yield* this.evalExpr(a)) as Val);
      if (objName === "Serial") {
        if (method === "print" || method === "println") { this.cb.serial(String(args[0] ?? "") + (method === "println" ? "\n" : "")); }
        return 0;
      }
      if (method === "readTemperature") return this.cb.sensorRead("temperature", "");
      if (method === "readHumidity") return this.cb.sensorRead("humidity", "");
      if (method === "begin" || method === "init" || method === "backlight" || method === "clear" ) { if (method === "clear") this.cb.lcdPrint("", true); return 0; }
      if (method === "print" || method === "println") { this.cb.lcdPrint(String(args[0] ?? ""), false); return 0; }
      if (method === "setCursor") return 0;
      if (method === "attach") { this.vars.set(`__servo_${objName}`, this.pinName(args[0])); return 0; }
      if (method === "write" && this.vars.has(`__servo_${objName}`)) { this.cb.servoWrite(String(this.vars.get(`__servo_${objName}`)), Number(args[0])); return 0; }
      if (method === "publish") { this.cb.mqttPublish(String(args[0]), String(args[1] ?? "")); return 1; }
      if (method === "connect" || method === "connected" || method === "loop" || method === "setServer") return 1;
      this.diagnostics.push(`Unmodelled method call ${objName}.${method}() treated as no-op`);
      return 0;
    }
    return 0;
  }
}
function truthy(v: Val): boolean { return v === true || (typeof v === "number" && v !== 0) || (typeof v === "string" && v !== "" && v !== "LOW" && v !== "false"); }

/* ================= Simulation engine ================= */
export interface ComponentState {
  on?: boolean; brightness?: number; currentMa?: number; voltage?: number;
  angle?: number; speed?: number; text?: string; segments?: Record<string, boolean>;
  value?: number;
}
export interface SimEvent { t: number; kind: "serial" | "mqtt" | "pin"; text: string; }
export class Simulation {
  public running = false; public timeMs = 0;
  public pinModes = new Map<string, string>();          // "comp:pin" -> mode
  public outputs = new Map<string, number>();           // "comp:pin" -> duty 0..1 (digital = 0/1)
  public states = new Map<string, ComponentState>();
  public events: SimEvent[] = [];
  public waveform = new Map<string, { t: number; v: number }[]>();
  private vm: SketchVM | null = null;
  /** LEDs/diodes currently in their conducting state (two-pass solver model). */
  private conducting = new Set<string>();
  private nets = new Map<string, string[]>();
  private netVoltage = new Map<string, number>();
  private mcuId: string;
  constructor(public project: Project) {
    this.mcuId = project.components.find((c) => getDef(c.type).behavior === "mcu")?.id ?? "";
    this.rebuildNets();
    this.solve();
  }
  private rebuildNets() { this.nets = buildNets(this.project); }
  private netKeyOf(comp: string, pin: string): string {
    const key = pinKey(comp, pin);
    for (const [root, members] of this.nets) if (members.includes(key)) return root;
    return key;
  }
  voltageAt(comp: string, pin: string): number { return this.netVoltage.get(this.netKeyOf(comp, pin)) ?? 0; }
  private setOutput(pin: string, duty: number) { if (this.mcuId) this.outputs.set(pinKey(this.mcuId, pin), duty); }
  private outputOf(comp: string, pin: string): number | undefined { return this.outputs.get(pinKey(comp, pin)); }
  private findOnNet(comp: string, pin: string, behavior: string) {
    const members = this.nets.get(this.netKeyOf(comp, pin)) ?? [];
    for (const m of members) { const [cid] = m.split(":"); const c = this.project.components.find((x) => x.id === cid); if (c && getDef(c.type).behavior === behavior) return c; }
    return undefined;
  }
  loadFirmware(code: string) {
    const self = this;
    this.vm = new SketchVM(code, {
      pinMode: (pin, mode) => { if (self.mcuId) self.pinModes.set(pinKey(self.mcuId, pin), mode); },
      digitalWrite: (pin, high) => { self.setOutput(pin, high ? 1 : 0); self.events.push({ t: self.timeMs, kind: "pin", text: `${pin} -> ${high ? "HIGH" : "LOW"}` }); },
      analogWrite: (pin, duty) => self.setOutput(pin, Math.max(0, Math.min(255, duty)) / 255),
      digitalRead: (pin) => {
        if (!self.mcuId) return false;
        const mode = self.pinModes.get(pinKey(self.mcuId, pin));
        // button / switch / sensor paths resolve through solved net voltage
        const v = self.voltageAt(self.mcuId, pin);
        if (v > 2.5) return true;
        if (mode === "INPUT_PULLUP") return v > 0.5; // pulled low only when a path to GND exists (v~0 with a driver) — approximated: floating reads HIGH
        return false;
      },
      analogRead: (pin) => Math.round((self.voltageAt(self.mcuId, pin) / (self.project.settings.supplyVoltage || 5)) * 1023),
      serial: (text) => self.events.push({ t: self.timeMs, kind: "serial", text }),
      servoWrite: (pin, angle) => { const s = self.findOnNet(self.mcuId, pin, "servo"); if (s) self.states.set(s.id, { ...self.states.get(s.id), angle }); },
      lcdPrint: (text, clear) => { const lcd = self.project.components.find((c) => getDef(c.type).behavior === "lcd"); if (lcd) { const cur = clear ? "" : (self.states.get(lcd.id)?.text ?? ""); self.states.set(lcd.id, { ...self.states.get(lcd.id), text: (cur + text).slice(-64) }); } },
      sensorRead: (kind) => {
        if (kind === "distance") { const s = self.project.components.find((c) => c.type === "hc-sr04"); return Number(s?.props.distanceCm ?? 0); }
        const dht = self.project.components.find((c) => c.type === "dht22" || c.type === "dht11");
        return Number(kind === "temperature" ? (dht?.props.temperature ?? 0) : (dht?.props.humidity ?? 0));
      },
      mqttPublish: (topic, payload) => self.events.push({ t: self.timeMs, kind: "mqtt", text: `${topic} ${payload}` }),
      millis: () => self.timeMs,
    });
  }
  start() { this.running = true; }
  pause() { this.running = false; }
  reset() { this.timeMs = 0; this.outputs.clear(); this.pinModes.clear(); this.states.clear(); this.events = []; this.waveform.clear(); this.vm = null; this.conducting.clear(); const code = this.project.files[0]?.content ?? ""; if (code) this.loadFirmware(code); this.solve(); }
  /** Advance simulation by dtMs of virtual time. Returns component states. */
  tick(dtMs: number) {
    if (this.vm) {
      let remaining = dtMs;
      // run VM in 10ms slices so circuit feedback (buttons/sensors) is seen between slices
      while (remaining > 0) {
        const slice = Math.min(10, remaining);
        const consumed = this.vm.step(slice);
        const advanced = consumed > 0 ? consumed : slice; // a slice with no delay still passes real time
        this.timeMs += advanced;
        remaining -= advanced;
        this.solve();
        for (const [k, duty] of this.outputs) {
          const arr = this.waveform.get(k) ?? []; arr.push({ t: this.timeMs, v: duty * 5 }); if (arr.length > 400) arr.shift(); this.waveform.set(k, arr);
        }
      }
    } else { this.timeMs += dtMs; this.solve(); }
    return this.states;
  }
  setProp(componentId: string, key: string, value: string | number | boolean) {
    const c = this.project.components.find((x) => x.id === componentId); if (!c) return;
    c.props[key] = value; this.rebuildNets(); this.solve();
  }
  /** Solve all nets: sources = MCU rails/outputs + supplies + analog sensors; loads = resistors, pots, LEDs… */
  solve() {
    this.rebuildNets();
    const supply = this.project.settings.supplyVoltage || 5;
    // relay energisation + LED conduction depend on the previous solve; iterate for stability
    for (let iter = 0; iter < 3; iter++) {
      const conductingSnapshot = new Set(this.conducting);
      const resistors: ResistorEl[] = []; const sources: VSource[] = [];
      const netKey = (comp: string, pin: string) => this.netKeyOf(comp, pin);
      const groundNets = new Set<string>();
      for (const c of this.project.components) {
        const def = getDef(c.type);
        for (const p of def.pins) if (p.kind === "ground") groundNets.add(netKey(c.id, p.id));
      }
      const G = "GND";
      const mapNet = (k: string) => (groundNets.has(k) ? G : k);
      for (const c of this.project.components) {
        const def = getDef(c.type);
        switch (def.behavior) {
          case "mcu": {
            sources.push({ id: `${c.id}:5V`, plus: mapNet(netKey(c.id, "5V")), minus: G, volts: supply });
            if (def.pins.some((p) => p.id === "3V3")) sources.push({ id: `${c.id}:3V3`, plus: mapNet(netKey(c.id, "3V3")), minus: G, volts: 3.3 });
            for (const [k, duty] of this.outputs) {
              const [cid, pin] = k.split(":");
              if (cid === c.id) sources.push({ id: `out:${k}`, plus: mapNet(netKey(cid, pin)), minus: G, volts: duty * supply });
            }
            break;
          }
          case "power": sources.push({ id: `${c.id}:src`, plus: mapNet(netKey(c.id, "VCC")), minus: G, volts: Number(c.props.voltage ?? supply) }); break;
          case "resistor": resistors.push({ id: c.id, a: mapNet(netKey(c.id, "1")), b: mapNet(netKey(c.id, "2")), r: Number(c.props.resistance ?? 220) }); break;
          case "potentiometer": { const total = Number(c.props.resistance ?? 10000); const v = Number(c.props.value ?? 0.5); resistors.push({ a: mapNet(netKey(c.id, "1")), b: mapNet(netKey(c.id, "W")), r: Math.max(1, total * (1 - v)) }); resistors.push({ a: mapNet(netKey(c.id, "W")), b: mapNet(netKey(c.id, "2")), r: Math.max(1, total * v) }); break; }
          case "sensor-analog": {
            if (c.type === "ldr") { const light = Number(c.props.light ?? 0.5); resistors.push({ id: c.id, a: mapNet(netKey(c.id, "1")), b: mapNet(netKey(c.id, "2")), r: 500 + (1 - light) * 9500 }); }
            else { const key = c.type === "soil-moisture" ? "moisture" : "gas"; const ratio = Number(c.props[key] ?? 0); sources.push({ id: `${c.id}:aout`, plus: mapNet(netKey(c.id, "AOUT")), minus: G, volts: ratio * supply }); }
            break;
          }
          case "led": { const vf = Number(c.props.forwardVoltage ?? 2); if (this.conducting.has(`led:${c.id}`)) { const mid = `led:${c.id}:mid`; sources.push({ id: `led:${c.id}`, plus: mapNet(netKey(c.id, "A")), minus: mid, volts: vf }); resistors.push({ id: `${c.id}:dyn`, a: mid, b: mapNet(netKey(c.id, "K")), r: 8 }); } else resistors.push({ id: `${c.id}:off`, a: mapNet(netKey(c.id, "A")), b: mapNet(netKey(c.id, "K")), r: 1e6 }); break; }
          case "rgb-led": for (const ch of ["R", "G", "B"]) { if (this.conducting.has(`rgb:${c.id}:${ch}`)) { const mid = `rgb:${c.id}:${ch}:mid`; sources.push({ id: `rgb:${c.id}:${ch}`, plus: mapNet(netKey(c.id, ch)), minus: mid, volts: 2 }); resistors.push({ a: mid, b: mapNet(netKey(c.id, "K")), r: 8 }); } else resistors.push({ a: mapNet(netKey(c.id, ch)), b: mapNet(netKey(c.id, "K")), r: 1e6 }); } break;
          case "diode": { if (this.conducting.has(`diode:${c.id}`)) { const mid = `diode:${c.id}:mid`; sources.push({ id: `diode:${c.id}`, plus: mapNet(netKey(c.id, "A")), minus: mid, volts: Number(c.props.forwardVoltage ?? 0.7) }); resistors.push({ a: mid, b: mapNet(netKey(c.id, "K")), r: 5 }); } else resistors.push({ a: mapNet(netKey(c.id, "A")), b: mapNet(netKey(c.id, "K")), r: 1e6 }); break; }
          case "inductor": resistors.push({ a: mapNet(netKey(c.id, "1")), b: mapNet(netKey(c.id, "2")), r: 0.5 }); break;
          case "sensor-digital": {
            if (c.type === "pir") sources.push({ id: `${c.id}:out`, plus: mapNet(netKey(c.id, "OUT")), minus: G, volts: c.props.motion ? supply : 0 });
            if (c.type === "ir-sensor") sources.push({ id: `${c.id}:out`, plus: mapNet(netKey(c.id, "OUT")), minus: G, volts: c.props.obstacle ? 0 : supply });
            break;
          }
          case "button": if (c.props.pressed) resistors.push({ a: mapNet(netKey(c.id, "1")), b: mapNet(netKey(c.id, "2")), r: 0.5 }); break;
          case "logic": if (this.states.get(c.id)?.on) sources.push({ id: `${c.id}:y`, plus: mapNet(netKey(c.id, "Y")), minus: G, volts: supply }); break;
        }
      }
      // weak pull-down on every net so floating inputs settle at 0 V instead of solver noise
      {
        const seen = new Set<string>();
        for (const members of this.nets.values()) for (const m of members) {
          const [cid, pid] = m.split(":");
          const k = mapNet(netKey(cid, pid));
          if (k !== G && !seen.has(k)) { seen.add(k); resistors.push({ a: k, b: G, r: 100000 }); }
        }
      }
      const nodeSet = new Set<string>([G]);
      for (const r of resistors) { nodeSet.add(r.a); nodeSet.add(r.b); }
      for (const s of sources) { nodeSet.add(s.plus); nodeSet.add(s.minus); }
      for (const members of this.nets.values()) for (const m of members) nodeSet.add(mapNet(this.netKeyOf(m.split(":")[0], m.split(":")[1])));
      // pull-downs: MCU input pins get a weak pull-down so floating-but-wired nets settle; INPUT_PULLUP handled in digitalRead
      const sol = solveAnalog([...nodeSet], resistors, sources, G);
      this.netVoltage = new Map();
      for (const [root, members] of this.nets) { void members; this.netVoltage.set(root, sol.nodeVoltage.get(mapNet(root)) ?? 0); }
      // ground nets are 0
      for (const g of groundNets) this.netVoltage.set(g, 0);
      // derive component states
      for (const c of this.project.components) {
        const def = getDef(c.type); const st: ComponentState = { ...this.states.get(c.id) };
        if (def.behavior === "led") {
          const key = `led:${c.id}`;
          const signed = sol.branchCurrent.get(key) ?? 0;
          const vA = this.voltageAt(c.id, "A"), vK = this.voltageAt(c.id, "K");
          // hysteresis: turn on when the open-circuit voltage reaches Vf, stay on while forward current flows.
          // Only the snapshot (what was actually modelled in this solve) may turn a device off.
          if (conductingSnapshot.has(key)) { if (signed < 0.0002) this.conducting.delete(key); }
          else if (vA - vK >= Number(c.props.forwardVoltage ?? 2)) this.conducting.add(key);
          const fwd = conductingSnapshot.has(key) && signed > 0.0002;
          const iMa = fwd ? signed * 1000 : 0;
          st.currentMa = iMa; st.brightness = Math.max(0, Math.min(1, iMa / 20)); st.on = iMa > 0.4; st.voltage = vA - vK;
        }
        if (def.behavior === "rgb-led") {
          const chans = ["R", "G", "B"].map((ch) => {
            const key = `rgb:${c.id}:${ch}`;
            const signed = sol.branchCurrent.get(key) ?? 0;
            const v = this.voltageAt(c.id, ch) - this.voltageAt(c.id, "K");
            if (conductingSnapshot.has(key)) { if (signed < 0.0002) this.conducting.delete(key); }
            else if (v >= 2) this.conducting.add(key);
            return conductingSnapshot.has(key) && signed > 0.0002 ? signed * 1000 : 0;
          });
          st.brightness = Math.min(1, Math.max(...chans) / 20); st.on = st.brightness > 0.02; st.value = chans[0] * 65536 + chans[1] * 256 + chans[2];
        }
        if (def.behavior === "diode") {
          const key = `diode:${c.id}`;
          const signed = sol.branchCurrent.get(key) ?? 0;
          const v = this.voltageAt(c.id, "A") - this.voltageAt(c.id, "K");
          if (conductingSnapshot.has(key)) { if (signed < 0.0002) this.conducting.delete(key); }
          else if (v >= Number(c.props.forwardVoltage ?? 0.7)) this.conducting.add(key);
        }
        if (def.behavior === "buzzer") st.on = this.voltageAt(c.id, "P") - this.voltageAt(c.id, "N") > 2;
        if (def.behavior === "dc-motor") { const v = Math.abs(this.voltageAt(c.id, "P") - this.voltageAt(c.id, "N")); st.speed = v / supply; st.on = v > 0.5; }
        if (def.behavior === "relay") { const on = this.voltageAt(c.id, "IN") > 2.5; if (Boolean(c.props.energised) !== on) { c.props.energised = on; this.rebuildNets(); } st.on = on; }
        if (def.behavior === "servo" && st.angle === undefined) st.angle = Number(c.props.angle ?? 0);
        if (def.behavior === "seven-seg") { const segs: Record<string, boolean> = {}; for (const s of ["a", "b", "c", "d", "e", "f", "g"]) segs[s] = this.voltageAt(c.id, s) > 2.5; st.segments = segs; }
        if (def.behavior === "logic") { const a = this.voltageAt(c.id, "A") > 2.5, b = this.voltageAt(c.id, "B") > 2.5; const y = c.props.gate === "OR" ? a || b : c.props.gate === "XOR" ? a !== b : a && b; st.on = y; st.value = y ? 1 : 0; /* output is exposed via state; wiring Y as a source: */ if (y) { /* handled next solve iteration through sources below */ } }
        this.states.set(c.id, st);
      }
      // logic gate outputs + button-to-rail paths need a second pass when they drive nets
      // (nets voltages for logic Y are set directly:)
      for (const c of this.project.components) if (getDef(c.type).behavior === "logic") {
        const st = this.states.get(c.id); const root = this.netKeyOf(c.id, "Y");
        if (st?.on) this.netVoltage.set(root, supply);
      }
    }
  }
}
