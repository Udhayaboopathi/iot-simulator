import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Play, Pause, Square, RotateCcw, Undo2, Redo2, Save, Download, Upload, Trash2, RotateCw, Plus } from "lucide-react";
import { COMPONENTS, CATEGORIES, getDef } from "../../../../packages/components-library/src/index.ts";
import { validateCircuit } from "../../../../packages/circuit-core/src/index.ts";
import { parseProject, serializeProject } from "../../../../packages/project-schema/src/index.ts";
import { EXAMPLES } from "../../../../examples/index.ts";
import { useStore, saveLocal } from "../store.ts";
import Editor2D from "./Editor2D.tsx";
import Editor3D from "./Editor3D.tsx";
import CodeEditor from "./CodeEditor.tsx";

type BottomTab = "serial" | "iot" | "wave" | "diag" | "code" | "files";

export default function Workspace() {
  const s = useStore();
  const [params] = useSearchParams();
  const [libQuery, setLibQuery] = useState("");
  const [tab, setTab] = useState<BottomTab>("serial");
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef<string>("");

  useEffect(() => {
    const ex = params.get("example");
    const tpl = params.get("template");
    const key = ex ?? tpl ?? "blank";
    if (loadedRef.current === key) return;
    loadedRef.current = key;
    const found = EXAMPLES.find((e) => e.id === ex) ?? EXAMPLES.find((e) => e.id === tpl);
    if (found) s.load(found.make());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // simulation loop: real-time ticking scaled by speed
  useEffect(() => {
    if (!s.running) return;
    let last = performance.now(); let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      useStore.getState().sim.tick(dt * useStore.getState().speed);
      force((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [s.running]);

  // optional buzzer sound
  useEffect(() => {
    if (!s.running) return;
    const anyBuzzer = s.project.components.some((c) => getDef(c.type).behavior === "buzzer" && s.sim.states.get(c.id)?.on);
    if (!anyBuzzer) return;
    try {
      const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      gain.gain.value = 0.04; osc.frequency.value = 880; osc.connect(gain); gain.connect(ctx.destination); osc.start();
      const stop = setTimeout(() => { osc.stop(); ctx.close(); }, 180);
      return () => { clearTimeout(stop); };
    } catch { /* no audio */ }
  });

  const warnings = useMemo(() => validateCircuit(s.project), [s.project]);
  const selected = s.project.components.find((c) => c.id === s.selected);
  const serialText = s.sim.events.filter((e) => e.kind === "serial").map((e) => e.text).join("");
  const mqttEvents = s.sim.events.filter((e) => e.kind === "mqtt");
  const lib = COMPONENTS.filter((c) => (c.name + c.category + c.id).toLowerCase().includes(libQuery.toLowerCase()));
  const wavePin = [...s.sim.waveform.entries()][0];

  const exportJson = () => {
    const blob = new Blob([serializeProject(s.project)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${s.project.id}.json`; a.click();
  };
  const importJson = (f: File) => {
    f.text().then((t) => { try { s.load(parseProject(t)); s.showToast("Project imported"); } catch (e) { s.showToast(`Import failed: ${e instanceof Error ? e.message : e}`); } });
  };

  return (
    <div className="ws">
      <div className="ws-toolbar">
        <strong style={{ fontSize: 15 }}>{s.project.name}</strong>
        <span className="chip">{s.project.board}</span>
        <span style={{ width: 8 }} />
        {!s.running ? <button className="btn green" onClick={s.run}><Play size={15} /> Run</button>
          : <button className="btn" onClick={s.pauseSim}><Pause size={15} /> Pause</button>}
        <button className="btn" onClick={s.stopSim}><Square size={14} /> Stop</button>
        <button className="btn" onClick={() => { s.stopSim(); s.showToast("Simulation reset"); }}><RotateCcw size={14} /> Reset</button>
        <label className="small muted">Speed <select className="input" style={{ width: 74, display: "inline-block", padding: "3px 6px" }} value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))}>
          <option value={0.25}>0.25×</option><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
        </select></label>
        <span className="chip">t = {(s.sim.timeMs / 1000).toFixed(2)} s</span>
        <span style={{ flex: 1 }} />
        <div className="tabs" style={{ border: "none", padding: 0 }}>
          {(["2d", "3d", "split"] as const).map((v) => <button key={v} className={s.view === v ? "on" : ""} onClick={() => s.setView(v)}>{v === "2d" ? "2D" : v === "3d" ? "3D" : "Split"}</button>)}
        </div>
        <button className="btn sm" disabled={!s.canUndo} onClick={s.undo}><Undo2 size={14} /></button>
        <button className="btn sm" disabled={!s.canRedo} onClick={s.redo}><Redo2 size={14} /></button>
        <button className="btn sm" onClick={() => { saveLocal(s.project); s.showToast("Saved to this browser" + (localStorage.getItem("iot-sim-token") ? " (sign in to sync via API from Dashboard)" : "")); }}><Save size={14} /> Save</button>
        <button className="btn sm" onClick={exportJson}><Download size={14} /> Export</button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); }} />
        <button className="btn sm" onClick={() => setTab("code")}>Code</button>
      </div>
      <div className="ws-main">
        <aside className="ws-lib">
          <input className="input" placeholder="Search components…" value={libQuery} onChange={(e) => setLibQuery(e.target.value)} />
          <div style={{ height: 8 }} />
          {CATEGORIES.map((cat) => {
            const items = lib.filter((c) => c.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="muted small" style={{ fontWeight: 700, margin: "8px 0 4px" }}>{cat}</div>
                {items.map((c) => (
                  <div key={c.id} className="lib-item" onClick={() => s.addComponent(c.id)} title={c.description}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong className="small">{c.name}</strong><Plus size={13} />
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>{c.simulated ? "simulated" : "definition only"}{c.capabilityNote ? " · partial" : ""}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </aside>
        <section className="ws-stage">
          {tab === "code" ? <CodeEditor /> : (
            <div className="split">
              {(s.view === "2d" || s.view === "split") && <div style={{ minHeight: 280 }}><Editor2D /></div>}
              {(s.view === "3d" || s.view === "split") && <div style={{ minHeight: 280, borderLeft: s.view === "split" ? "1px solid var(--line)" : "none" }}><Editor3D /></div>}
            </div>
          )}
          <div className="ws-bottom">
            <div className="tabs">
              {(["serial", "iot", "wave", "diag", "code", "files"] as BottomTab[]).map((t) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                  {t === "serial" ? "Serial Monitor" : t === "iot" ? `IoT / MQTT (${mqttEvents.length})` : t === "wave" ? "Waveform" : t === "diag" ? `Diagnostics (${warnings.length})` : t === "code" ? "Code Editor" : "Project Files"}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button onClick={() => { s.sim.events = []; force((x) => x + 1); }}>Clear output</button>
            </div>
            {tab === "serial" && <div className="serial">{serialText || "Serial output appears here when the sketch prints. Press Run."}</div>}
            {tab === "iot" && (
              <div className="serial">
                {mqttEvents.length ? mqttEvents.map((e, i) => <div key={i}>[{e.t} ms] MQTT publish → {e.text}</div>) : "No MQTT traffic yet. Open the ESP32 MQTT example to see virtual-broker telemetry."}
                <div style={{ marginTop: 8 }}>{s.project.components.filter((c) => ["sensor-digital", "sensor-analog"].includes(getDef(c.type).behavior)).map((c) => <span key={c.id} className="chip" style={{ marginRight: 6 }}>{c.label}: {Object.entries(c.props).map(([k, v]) => `${k}=${v}`).join(", ")}</span>)}</div>
              </div>
            )}
            {tab === "wave" && (
              <div style={{ padding: 10 }}>
                {wavePin ? (
                  <svg className="wave" viewBox="0 0 600 90" preserveAspectRatio="none">
                    <polyline fill="none" stroke="#10b981" strokeWidth="2" points={wavePin[1].map((pt, i) => `${(i / Math.max(1, wavePin[1].length - 1)) * 600},${84 - (pt.v / 5) * 78}`).join(" ")} />
                  </svg>
                ) : <div className="muted" style={{ padding: 8 }}>Waveform appears after the firmware drives an output pin.</div>}
                {wavePin && <div className="muted small">{wavePin[0]} — last {(wavePin[1].length / 100).toFixed(1)} s window</div>}
              </div>
            )}
            {tab === "diag" && <div className="serial">{warnings.length ? warnings.map((w) => `⚠ ${w}`).join("\n") : "✓ No circuit warnings. Nets, resistor checks and short-circuit checks pass."}</div>}
            {tab === "files" && <div className="serial">{s.project.files.map((f) => `${f.name} (${f.language}, ${f.content.length} chars)`).join("\n")}</div>}
          </div>
        </section>
        <aside className="ws-insp">
          <strong>Inspector</strong>
          {!selected && <p className="muted small">Select a component in 2D or 3D to edit its properties. Both views edit the same circuit graph.</p>}
          {selected && (() => {
            const def = getDef(selected.type);
            return (
              <div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{selected.label}</div>
                <div className="muted small">{def.name} — {def.description}</div>
                {def.capabilityNote && <div className="small" style={{ color: "var(--warn)", marginTop: 4 }}>{def.capabilityNote}</div>}
                <div className="prop-row"><span>Label</span><input className="input" style={{ width: 110 }} value={selected.label} onChange={(e) => { const p = s.project; s.commit({ ...p, components: p.components.map((c) => (c.id === selected.id ? { ...c, label: e.target.value } : c)) }); }} /></div>
                <div className="prop-row"><span>Position</span><span className="small muted">{selected.pos2d.x}, {selected.pos2d.y} · 3D {selected.pos3d.x}, {selected.pos3d.z}</span></div>
                {Object.entries(selected.props).map(([k, v]) => (
                  <div className="prop-row" key={k}>
                    <span className="small">{k}</span>
                    {typeof v === "boolean"
                      ? <input type="checkbox" checked={v} onChange={(e) => s.setProp(selected.id, k, e.target.checked, true)} />
                      : typeof v === "number"
                        ? <span style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="range" min={k === "angle" ? 0 : k === "distanceCm" ? 2 : 0} max={k === "angle" ? 180 : k === "distanceCm" ? 400 : k === "resistance" ? 10000 : k === "temperature" ? 60 : k === "humidity" ? 100 : 1} step={k === "resistance" ? 10 : 0.05} value={v} onChange={(e) => s.setProp(selected.id, k, Number(e.target.value), true)} style={{ width: 76 }} /><input className="input" type="number" style={{ width: 64, padding: "3px 6px" }} value={v} onChange={(e) => s.setProp(selected.id, k, Number(e.target.value), true)} /></span>
                        : <input className="input" style={{ width: 110 }} value={String(v)} onChange={(e) => s.setProp(selected.id, k, e.target.value)} />}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn sm" onClick={s.rotateSelected}><RotateCw size={13} /> Rotate</button>
                  <button className="btn sm danger" onClick={s.deleteSelected}><Trash2 size={13} /> Delete</button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <strong className="small">Pins</strong>
                  <div className="small muted">{def.pins.map((p) => `${p.label} (${p.kind})`).join(" · ")}</div>
                </div>
              </div>
            );
          })()}
          <div style={{ marginTop: 16 }}>
            <strong className="small">Wires ({s.project.wires.length})</strong>
            {s.project.wires.map((w) => (
              <div key={w.id} className="prop-row small">
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: w.color, marginRight: 5 }} />{w.from.component}.{w.from.pin} → {w.to.component}.{w.to.pin}</span>
                <button className="btn sm" onClick={() => s.removeWire(w.id)}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }} className="muted small">
            <strong style={{ color: "var(--ink)" }}>Shortcuts</strong><br />
            <span className="kbd">Click pin → pin</span> wire · <span className="kbd">Drag</span> move · <span className="kbd">Wheel</span> zoom · <span className="kbd">Ctrl/⌘+S</span> in Save button · Undo/redo in toolbar
          </div>
          <div style={{ marginTop: 10 }}><Link to="/examples" className="small">← Back to examples</Link></div>
        </aside>
      </div>
      {s.toast && <div className="toast">{s.toast}</div>}
    </div>
  );
}
