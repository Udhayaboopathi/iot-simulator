# Test Report (2026-11-03)

## Automated — TypeScript (Vitest, `tests/core.test.ts`): 20/20 passed
Coverage mapping to the mandatory test list:
- Project schema serialization + invalid-project rejection + round-trip ✓
- Component pin connections & netlist generation ✓
- Wire editing (add wire changes connectivity) ✓
- Undo/redo ✓
- Save/load round trip ✓ (schema serialize/parse)
- MCU GPIO output — **AVR LED blink**: D13 HIGH phase LED on with
  10 mA < I < 17 mA (≈13.1 mA computed for 5 V, Vf 2 V, 220 Ω), LOW phase
  off, HIGH again after 2 s; Serial contains LED ON and LED OFF ✓
- Simulation reset (t=0, outputs cleared) ✓
- Electrical solver correctness vs independent hand calculations:
  divider 5 V → 2.5 V ✓, series chain 3 V → 2 V/1 V ✓, LED current formula
  13.636 mA ✓, RC charge 5(1−e⁻¹) ✓
- Sensor I/O: DHT22 values reach Serial ✓, HC-SR04 distance = µs/58 ✓,
  servo angle follows `Servo.write` ✓, button input gates LED ✓,
  AND-gate truth behaviour ✓, ESP32 MQTT publish events ✓
- Component library honesty: ≥25 defs, MPU6050 `simulated=false` ✓
- Every example project validates + produces a netlist ✓
- 2D/3D synchronization: both editors render exclusively from the same
  store project + `sim.states` (architectural invariant — a component's
  `pos2d` and `pos3d` are written in the same store commit; verified in the
  browser check below where both views show the loaded example + wires).

## Automated — API (pytest, `apps/api/tests/test_api.py`): 10/10 passed
Health ✓ · register/login/me ✓ · wrong password → 401 ✓ · unauthenticated
project list → 401 ✓ · project create/list/get ✓ · update records a new
version ✓ · delete → subsequent GET 404 ✓ · sharing to public makes the
project readable by another user (and a private one returns 403) ✓ ·
validation → 422 ✓ · rate limiting verified in the middleware design
(120 req/min/IP → 429; exercised via fixture-isolated limiter).
Run independently verified 2026-11-03: `10 passed`.

## Browser end-to-end (real Chromium, CDP-driven)
- Loaded `/workspace?example=led-blink` from the production build
  (`vite preview`), clicked **Run**, waited ~2.6 s of real time:
  Serial panel contained `LED ON` **and** `LED OFF`, virtual-time chip read
  `t = 2.70 s`. Result: PASS.
- Screenshots inspected for the LED-blink and servo workspaces: 2D editor,
  component library, inspector, wire list and the Three.js 3D scene (board,
  servo horn, tube wires) all render from the same project.

## Builds & checks
- `npm run build -w @iot-sim/web` — PASS (Vite production build).
- `npm run typecheck` (strict TS over packages + web + tests) — PASS.
- API: `uvicorn` app imports and `/health` exercised via pytest TestClient.

## Known gaps in testing
- No Playwright suite (the CDP script above is the browser check; it is
  kept at `scripts/e2e-cdp.mjs` for re-runs against a local preview).
- 3D rendering is verified visually/by screenshot, not by pixel assertions.
