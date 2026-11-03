# Technology Findings

## MCU emulation candidates
- **avr8js** (Wokwi, MIT): real ATmega328P instruction emulation in the
  browser. Integration requires producing/loading Intel HEX from a compiler
  toolchain and bridging its peripheral models to our net solver. Viable next
  step; NOT integrated in this build, so no binary-level Arduino claim is made.
- **rp2040js** (Wokwi, MIT): RP2040 emulation, same HEX/UF2 bridging cost.
- Decision for this build: a purpose-built **Arduino-subset sketch VM**
  (parser + generator-based interpreter with a virtual clock) executes the
  exact API surface the examples use — pinMode, digital/analog I/O, delay,
  millis, Serial, Servo, DHT, pulseIn, LCD print, MQTT publish — against the
  live solved circuit. It is real execution of the sketch source, honestly
  labelled a subset, with unsupported calls surfaced as diagnostics.

## Circuit solving
- **circuitjs1** (GPL), **ngspice** (custom/BSD-like + heavy WASM port),
  **WebSpice** — evaluated; embedding GPL or a full SPICE WASM build was
  disproportionate for the DC/digital scope targeted here.
- Decision: original **modified nodal analysis (MNA)** solver in TypeScript
  (~120 lines) supporting resistors, voltage sources (MCU pins, supplies,
  analog sensor outputs), potentiometer/LDR models, and LED/diode
  Vf + dynamic-resistance models with conduction hysteresis. Validated
  against hand-computed divider/series/LED-current values in tests.
  RC transient helper included; full transient/SPICE remains future work.

## Editors
- 2D: custom SVG engine chosen over React Flow/Konva — pin-level wiring,
  net highlighting and rotation semantics are circuit-specific; SVG keeps
  hit-testing and text crisp with zero extra runtime weight.
- 3D: Three.js directly (OrbitControls from addons) rather than React Three
  Fiber — the scene is rebuilt from the circuit graph and updated imperatively
  each frame from simulation state; R3F would add a reconciler layer without
  changing the result.
- Code editor: lightweight textarea editor with line numbers + real parser
  diagnostics. Monaco was NOT bundled (CDN loader is unreliable in offline/
  self-hosted use); recorded as PARTIAL in the parity matrix.

## Platform
- Frontend: React + Vite SPA (refined from the Next.js preference: the
  product is a client-side IDE; SSR adds no user value, and the API is a
  separate FastAPI service). Tailwind CSS v4 + custom design tokens,
  Zustand store, Lucide icons.
- Backend: FastAPI + stdlib SQLite (no external services needed to run),
  PBKDF2 password hashing, bearer-token sessions, project versions + sharing,
  per-IP rate limiting. PostgreSQL/Valkey/MQTT-broker deployment is described
  in `infra/` as the scale-out path, not required for local use.
