# Architecture

## One simulation engine, two views
`packages/project-schema` defines the single, versioned circuit graph:
project → components (each with `pos2d` **and** `pos3d`), wires (pin-to-pin),
source files, settings. There is exactly one netlist: `packages/circuit-core`
derives electrical nets from the wires with union-find. The 2D SVG editor,
the Three.js 3D editor and the simulators all read and mutate this graph
through one Zustand store (`apps/web/src/store.ts`). Moving a part in 2D
rewrites `pos3d.x/z` in the same commit; simulation state is keyed by
component id, so both views render the same state in the same frame.

## Layers
- `packages/project-schema` — types, validation, (de)serialisation, migrations.
- `packages/components-library` — 30 typed component definitions: pins,
  2D footprint, 3D shape/colour, default props, honest `simulated` flags.
- `packages/circuit-core` — nets, netlist generation, circuit validation
  (shorts, LED resistor check), immutable undo/redo `History`.
- `packages/simulation-core` —
  - `solveAnalog`: modified nodal analysis (resistors, ideal voltage
    sources, potentiometers, LDRs, LED/diode Vf models with conduction
    hysteresis, analog sensor sources, weak pull-downs for floating nets).
  - `SketchVM`: Arduino-subset parser + generator interpreter. `delay()`
    yields to the engine, so execution interleaves with circuit re-solves
    every ≤10 ms of virtual time — button presses and sensor changes are
    seen by running firmware.
  - `Simulation`: binds a project + firmware, steps the VM, re-solves nets,
    derives component states (LED current/brightness, buzzer, motor speed,
    relay contacts — which feed back into the net graph — servo angle,
    7-segment pattern, LCD text), records Serial/MQTT events and waveforms.
- `apps/web` — React SPA: public pages, account pages, and the workspace
  (library / 2D / 3D / code / inspector / serial-IoT-waveform-diagnostics).
- `apps/api` — FastAPI: PBKDF2 auth + bearer sessions, project CRUD with
  version history and visibility sharing, rate limiting, SQLite storage.

## Data flow during a run
rAF loop → `sim.tick(dt × speed)` → VM slices (≤10 ms) → `solve()` (nets →
MNA → states) → React re-render → 2D SVG + Three.js emissive/rotation updates
read the same `sim.states`.

## Network boundary
Firmware has no network access. `mqtt.publish()` calls in a sketch are
captured by the VM into an in-app virtual-broker event log (the IoT panel).
That is modelled protocol behaviour and is labelled as such everywhere.

## Persistence
Browser: project JSON in localStorage. Server: the same JSON in SQLite via
the API, with a version row per update. Export/import uses the identical
schema, so files round-trip between browser, disk and server unchanged
(covered by tests).
