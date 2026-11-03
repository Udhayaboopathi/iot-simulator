import { useMemo, useState } from "react";
import { SketchVM } from "../../../../packages/simulation-core/src/index.ts";
import { useStore } from "../store.ts";

/** Lightweight code editor (line numbers, tab support, compile check through
 *  the real SketchVM parser). Monaco is documented as a PARTIAL/adapters item
 *  in KNOWN_LIMITATIONS — this editor never pretends to be Monaco. */
export default function CodeEditor() {
  const { project, setCode, showToast } = useStore();
  const code = project.files[0]?.content ?? "";
  const [diag, setDiag] = useState<string[]>([]);
  const lines = useMemo(() => code.split("\n").length, [code]);
  const check = () => {
    try {
      const vm = new SketchVM(code, { pinMode: () => {}, digitalWrite: () => {}, analogWrite: () => {}, digitalRead: () => false, analogRead: () => 0, serial: () => {}, servoWrite: () => {}, lcdPrint: () => {}, sensorRead: () => 0, mqttPublish: () => {}, millis: () => 0 });
      setDiag(vm.diagnostics.length ? vm.diagnostics : ["✓ Sketch parses — no errors. Run the simulation to execute it."]);
      showToast("Compile check done");
    } catch (err) {
      setDiag([`✗ ${err instanceof Error ? err.message : String(err)}`]);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, padding: 6, borderBottom: "1px solid var(--line)", alignItems: "center" }}>
        <span className="chip">{project.files[0]?.name ?? "sketch.ino"}</span>
        <button className="btn sm" onClick={check}>Compile check</button>
        <span className="muted small">Arduino C++ subset — pinMode, digital/analog I/O, delay, Serial, Servo, DHT, pulseIn, MQTT publish</span>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <pre className="code-editor muted" style={{ margin: 0, padding: "10px 6px", textAlign: "right", userSelect: "none", overflow: "hidden", borderRight: "1px solid var(--line)" }}>
          {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
        </pre>
        <textarea className="input code-editor" style={{ flex: 1, border: "none", borderRadius: 0, resize: "none", padding: 10, outline: "none" }}
          value={code} spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); } }}
        />
      </div>
      {diag.length > 0 && <div className="serial" style={{ maxHeight: 90, borderTop: "1px solid var(--line)" }}>{diag.join("\n")}</div>}
    </div>
  );
}
