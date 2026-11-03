# CircuitVerse Sim — 2D + 3D IoT Electronics Simulator

An original, open-source, browser-based IoT electronics simulation platform:
design a circuit once and see it in **2D and 3D at the same time**, write
Arduino-style firmware that **actually executes** against the circuit, and
watch real solved voltages and currents drive LEDs, servos, motors, relays,
displays and sensors.

> Capability honesty is a feature here. Components and workflows are labelled
> **simulated**, **partial**, or **definition only** — in the UI, in
> `FEATURE_PARITY_MATRIX.md`, and in `KNOWN_LIMITATIONS.md`. Nothing lights
> up unless the simulation engine computed it.

## Quick start

```bash
# Web app (frontend + simulation, no server needed)
npm install
npm run dev            # http://localhost:5173  → open "LED Blink" example, press Run

# Tests
npm test               # vitest: schema, netlist, solver, firmware VM, examples
npm run typecheck
npm run build -w @iot-sim/web

# Optional backend (accounts, server-side projects, sharing)
cd apps/api && pip install -r requirements.txt
uvicorn app.main:app --port 8000
# or: docker compose -f infra/docker-compose.yml up --build
```

## The LED Blink test (the demo that proves it works)
Open **Examples → Arduino LED Blink** (or `examples/led-blink.json`), press
**Run**: the sketch VM executes `sketch.ino`, D13 toggles every 1000 ms of
virtual time, the MNA solver computes ≈13.1 mA through the 220 Ω resistor,
and the LED glows in **both** the 2D workbench and the 3D scene while Serial
prints `LED ON` / `LED OFF`. This exact behaviour is locked in by automated
tests (`tests/core.test.ts`) and a browser end-to-end check (see
`TEST_REPORT.md`).

## Repository map
```text
apps/web/            React SPA — public/account pages + the IDE workspace
apps/api/            FastAPI backend — auth, project CRUD, versions, sharing
packages/
  project-schema/    the one versioned circuit graph (single source of truth)
  circuit-core/      nets, netlist, validation, undo/redo
  components-library/ 30 typed component definitions (pins, 2D, 3D, behaviour)
  simulation-core/   MNA analog solver + Arduino-subset sketch VM + engine
  shared/            ids, grid snapping, math helpers
examples/            10 runnable projects (.json + .ino + index.ts)
docs/                research (REA evidence), dependency register
tests/               vitest suite
infra/               docker compose for web + api
```
(The brief's finer package split — editor-2d, editor-3d, mcu-emulators,
virtual-network, etc. — lives as modules inside `apps/web/src/editor/` and
`packages/simulation-core/`; the separation between rendering, state,
electrical simulation and firmware execution is kept strict.)

## Examples
LED blink · traffic light · push-button LED · DHT22 readout · HC-SR04
distance · servo sweep · LCD 16×2 · RGB LED · AND-gate logic · ESP32 MQTT
telemetry (partial — virtual broker). Each ships with expected results and
is covered by tests.

## Docs
- `ARCHITECTURE.md` — one graph / two views, layers, data flow
- `IMPLEMENTATION_STATUS.md` — what is done, per stage
- `FEATURE_PARITY_MATRIX.md` — every feature: IMPLEMENTED / PARTIAL / BLOCKED / NOT STARTED, with evidence
- `KNOWN_LIMITATIONS.md` — read this before trusting a simulation result
- `TEST_REPORT.md` — test inventory and results
- `docs/OPEN_SOURCE_DEPENDENCIES.md` — licenses and integration decisions
- `docs/research/` — REA MCP evidence and reference-platform analysis

## License
MIT. Built by Udhayaboopathi V. Reference platforms were studied through
publicly observable behaviour only; no proprietary code, assets or branding
are included.
