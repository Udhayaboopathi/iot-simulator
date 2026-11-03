import { Link } from "react-router-dom";
import { Cpu, Boxes, Code2, Radio, Gauge, Share2 } from "lucide-react";
import { COMPONENTS, CATEGORIES } from "../../../../packages/components-library/src/index.ts";
import { EXAMPLES } from "../../../../examples/index.ts";

export function Home() {
  return (
    <div>
      <section className="hero">
        <span className="chip">Open-source · runs entirely in your browser</span>
        <h1>Design, code and simulate IoT circuits in 2D and 3D — one circuit, both views.</h1>
        <p>Place real components, wire real nets, run real firmware on a sketch VM, and solve the circuit with a proper nodal-analysis engine. When a part moves in 2D it moves in 3D, because both editors edit the same circuit graph.</p>
        <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn primary" to="/workspace?example=led-blink">Open the LED Blink demo</Link>
          <Link className="btn" to="/examples">Browse examples</Link>
          <Link className="btn" to="/workspace">Start a blank project</Link>
        </div>
      </section>
      <div className="wrap">
        <div className="grid c3">
          {[
            { icon: <Boxes size={20} />, t: "One graph, two editors", d: "A shared, versioned circuit schema drives the 2D workbench and the Three.js 3D scene. No duplicate netlists, ever." },
            { icon: <Cpu size={20} />, t: "Real simulation", d: "Modified nodal analysis for voltages and LED currents, digital net propagation, PWM, sensors, relays and logic gates." },
            { icon: <Code2 size={20} />, t: "Firmware that actually runs", d: "An Arduino-subset interpreter executes your sketch against the live circuit — buttons, DHT22, HC-SR04, servos, LCD and Serial included." },
            { icon: <Radio size={20} />, t: "Virtual IoT network", d: "ESP32 sketches publish to a sandboxed virtual MQTT broker panel. Clearly labelled: protocol behaviour is modelled, radios are not emulated." },
            { icon: <Gauge size={20} />, t: "Waveforms & diagnostics", d: "Live pin waveforms, short-circuit warnings and missing-resistor checks while you build." },
            { icon: <Share2 size={20} />, t: "Save, share, export", d: "Projects autosave locally, export/import as JSON, and sync through the FastAPI backend when you sign in." },
          ].map((f) => <div className="card" key={f.t}><div style={{ color: "var(--brand)" }}>{f.icon}</div><h3 style={{ margin: "8px 0 4px" }}>{f.t}</h3><p className="muted" style={{ margin: 0 }}>{f.d}</p></div>)}
        </div>
        <h2 className="sec">Working examples</h2>
        <ExamplesGrid />
        <h2 className="sec">Honest capability labels</h2>
        <p className="muted">Every component carries a <strong>simulated</strong> or <strong>definition only</strong> label, and partial features say so in the UI and in <Link to="/docs">the docs</Link>. Nothing here is a fake Run button: if it lights up, the engine computed it.</p>
      </div>
    </div>
  );
}
export function ExamplesGrid() {
  return (
    <div className="grid c3">
      {EXAMPLES.map((e) => { const p = e.make(); return (
        <div className="card" key={e.id}>
          <h3 style={{ margin: "0 0 4px" }}>{p.name}</h3>
          <p className="muted small" style={{ minHeight: 54 }}>{p.description}</p>
          <div className="small" style={{ marginBottom: 10 }}><strong>Expected:</strong> {e.expected}</div>
          <Link className="btn primary sm" to={`/workspace?example=${e.id}`}>Open & run</Link>{" "}
          <Link className="btn sm" to="/docs">Docs</Link>
        </div> ); })}
    </div>
  );
}
export function Features() {
  return <div className="wrap"><h1>Features</h1>
    {[["2D workbench", "Infinite-feeling pan/zoom canvas, snap-to-grid, pin-aware wiring with real connectivity, net highlighting on hover, multi-part drag, rotation, duplicate via library, undo/redo, circuit validation (shorts, LED resistor checks), JSON import/export."],
      ["3D workbench", "Three.js scene generated from the same graph: orbit/pan/zoom, top/front/isometric presets, raycast selection, pin spheres from the same pin metadata, tube wires, live LED glow, servo horns and motor spin driven by simulation state."],
      ["Simulation", "MNA DC solver (resistors, dividers, potentiometers, LDRs, LED/diode forward models), digital propagation, PWM duty, pull behaviour, relay contact switching, logic gates, RC transient helper."],
      ["Firmware", "Arduino-subset VM: setup/loop, variables, if/for/while, functions, pinMode/digitalWrite/digitalRead/analogWrite/analogRead, delay with a virtual clock, millis, map/constrain, Serial, Servo, DHT, pulseIn, LCD print, MQTT publish."],
      ["IoT", "Virtual Wi-Fi/MQTT boundary: publishes appear in the IoT panel with timestamps; sensor telemetry chips update live. No access to real networks from firmware."],
      ["Platform", "Landing, features, component library, examples, docs, tutorials, auth pages, dashboard, templates, sharing and settings — backed by an optional FastAPI + SQLite API with versions and sharing."],
    ].map(([t, d]) => <div className="card" key={t} style={{ marginBottom: 10 }}><h3 style={{ margin: "0 0 4px" }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
  </div>;
}
export function ComponentsPage() {
  return <div className="wrap"><h1>Component library</h1><p className="muted">{COMPONENTS.length} typed definitions across {CATEGORIES.length} categories. “Simulated” means behaviour is implemented and covered by automated tests.</p>
    {CATEGORIES.map((cat) => <div key={cat}><h2 className="sec">{cat}</h2><table className="tbl"><thead><tr><th>Component</th><th>Pins</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      {COMPONENTS.filter((c) => c.category === cat).map((c) => <tr key={c.id}><td><strong>{c.name}</strong><div className="muted small">{c.description}</div></td><td className="small">{c.pins.map((p) => p.label).join(", ")}</td><td>{c.simulated ? <span className="chip">simulated</span> : <span className="chip">definition only</span>}</td><td className="small muted">{c.capabilityNote ?? "—"}</td></tr>)}
    </tbody></table></div>)}
  </div>;
}
export function ExamplesPage() { return <div className="wrap"><h1>Examples gallery</h1><p className="muted">Every example is a real project file in the repo (<code>examples/</code>) and runs in the workspace.</p><ExamplesGrid /></div>; }
export function DocsPage() {
  return <div className="wrap"><h1>Documentation</h1>
    {[["Getting started", "Open an example, press Run, and change sensor values in the right-hand inspector while it runs. The 2D and 3D views always show the same state."],
      ["Wiring", "Click any pin, then click a pin on another component. Hover a pin to highlight its whole electrical net. Wires are connectivity, not decoration — the solver and the netlist are built from them."],
      ["Firmware subset", "The sketch VM supports a documented Arduino C++ subset (see the Code tab in the workspace). Unsupported library calls are reported as diagnostics and treated as no-ops — never silently faked. AVR8js/RP2040js integration is the documented next step for binary-level emulation."],
      ["Simulation model", "DC operating point via modified nodal analysis. LEDs/diodes use a Vf + dynamic-resistance model with conduction hysteresis. Digital inputs read solved net voltages; analog inputs read net voltage scaled to 0–1023."],
      ["Keyboard", "Toolbar undo/redo, pin-to-pin wiring, drag to move, wheel to zoom, drag background to pan. In 3D: drag to orbit, right-drag to pan, wheel to zoom."],
      ["Saving", "Save stores the project JSON in your browser. Sign in and use the API from the Dashboard to persist server-side with version history and sharing. Export downloads the same JSON the backend stores."],
    ].map(([t, d]) => <div className="card" key={t} style={{ marginBottom: 10 }}><h3 style={{ margin: "0 0 4px" }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
  </div>;
}
export function TutorialsPage() {
  return <div className="wrap"><h1>Tutorials</h1>
    {[["1 · Blink an LED", "Open the LED Blink example. Find the 220 Ω resistor in the LED's anode net, press Run, and watch Serial print LED ON/OFF while the 3D LED glows. Change delay(1000) to delay(200) in the Code tab and run again.", "/workspace?example=led-blink"],
      ["2 · Read a button", "Open Push-Button LED Control. Run it, then click the button in either view. The firmware reads D2 every loop and mirrors it to D13.", "/workspace?example=button-led"],
      ["3 · Measure distance", "Open the Ultrasonic example. Move the distanceCm slider in the inspector and read the Serial distance. The sketch converts echo microseconds with distance = µs / 58 — the same formula as real HC-SR04 code.", "/workspace?example=ultrasonic"],
      ["4 · Publish telemetry", "Open the ESP32 MQTT example, run it, and open the IoT / MQTT tab under the stage. Every publish is a real event from the executing sketch, inside the virtual network boundary.", "/workspace?example=esp32-mqtt"],
    ].map(([t, d, link]) => <div className="card" key={t} style={{ marginBottom: 10 }}><h3 style={{ margin: "0 0 4px" }}>{t}</h3><p className="muted">{d}</p><Link className="btn sm primary" to={link}>Start tutorial</Link></div>)}
  </div>;
}
export function About() { return <div className="wrap"><h1>About</h1><p className="muted">CircuitVerse Sim is an original, open-source browser IoT simulator built for learning and prototyping. It was designed after studying the publicly observable workflows of Wokwi, Tinkercad Circuits, Tinkered and Webots Cloud — workflows were reproduced, no proprietary code, assets or branding were copied. See <code>docs/research/</code> in the repository for the evidence trail.</p></div>; }
export function Contact() {
  return <div className="wrap" style={{ maxWidth: 640 }}><h1>Contact</h1><p className="muted">Questions and bug reports are welcome on the GitHub repository issues page.</p>
    <form className="card" onSubmit={(e) => { e.preventDefault(); alert("Thanks — for a real reply, please open a GitHub issue on the repository."); }}>
      <label className="small">Your email<input className="input" type="email" required style={{ margin: "4px 0 10px" }} /></label>
      <label className="small">Message<textarea className="input" required rows={5} style={{ margin: "4px 0 10px" }} /></label>
      <button className="btn primary">Send</button>
    </form></div>;
}
export function Legal({ kind }: { kind: "privacy" | "terms" }) {
  return <div className="wrap"><h1>{kind === "privacy" ? "Privacy Policy" : "Terms of Use"}</h1>
    {kind === "privacy"
      ? <p className="muted">Projects you save in the browser stay in your browser (localStorage) unless you sign in and sync them to the API. The API stores only your account email, a salted password hash, and the project JSON you choose to save. Firmware runs in a sandbox with no network access. We do not sell data; there are no third-party trackers in this build.</p>
      : <p className="muted">This software is provided under the MIT License, “as is”, without warranty. Simulations are educational approximations of real electronics — always verify designs against datasheets before building hardware. You are responsible for content you create and share.</p>}
  </div>;
}
export function NotFound() { return <div className="wrap" style={{ textAlign: "center", paddingTop: 60 }}><h1>404</h1><p className="muted">That page doesn't exist.</p><Link className="btn primary" to="/">Go home</Link></div>; }
