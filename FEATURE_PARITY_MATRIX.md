# Feature Parity Matrix (2026-11-03)

Status key: IMPLEMENTED (working + evidence) · PARTIAL (working subset,
labelled) · BLOCKED (external blocker) · NOT STARTED.

| Feature | Status | Evidence |
|---|---|---|
| Shared circuit graph (one source of truth) | IMPLEMENTED | `packages/project-schema`; round-trip tests |
| 2D editor: pan/zoom/grid/snap | IMPLEMENTED | Workspace screenshot; `Editor2D.tsx` |
| 2D wiring with real connectivity | IMPLEMENTED | Netlist/areConnected tests |
| Net highlighting, validation, warnings | IMPLEMENTED | Hover nets in UI; validateCircuit tests |
| Undo/redo, save/load, JSON import/export | IMPLEMENTED | History tests; UI Save/Export/Import |
| Copy/paste & duplicate | PARTIAL | Add-from-library + delete/rotate exist; clipboard copy/paste not implemented |
| 3D editor: orbit/pan/zoom, presets | IMPLEMENTED | Workspace screenshot (servo example) |
| 3D selection sync with 2D | IMPLEMENTED | Raycast → shared store selection |
| 3D wires from same pins | IMPLEMENTED | TubeGeometry wires in screenshot |
| Live 3D state (LED glow, servo, motor) | IMPLEMENTED | Emissive/rotation updates from `sim.states` |
| glTF/GLB vendor models | NOT STARTED | Original primitive models instead (documented) |
| Component library (30 defs) | IMPLEMENTED | `components-library`; count test ≥25 |
| MCU boards (Uno/Nano/Mega/ESP32/Pico) | PARTIAL | GPIO via sketch VM; no binary emulation |
| Digital simulation (GPIO/PWM/pull/input) | IMPLEMENTED | Engine tests (button, logic, PWM RGB) |
| Analog simulation (MNA DC) | IMPLEMENTED | Divider/series/LED-current tests vs hand calcs |
| Transient/AC SPICE | PARTIAL | RC helper only |
| Firmware execution | PARTIAL | Arduino-subset VM — real source execution, documented subset |
| Serial monitor | IMPLEMENTED | Browser e2e: LED ON/OFF captured from the real UI |
| Compiler diagnostics | PARTIAL | Parser errors + unmodelled-call diagnostics; no full C++ compiler |
| Sensors (DHT, HC-SR04, PIR, LDR, soil, gas, IR) | IMPLEMENTED | DHT/ultrasonic tests; inspector-driven live values |
| MPU6050 IMU, SSD1306 OLED | NOT STARTED | Definitions only, labelled in UI |
| LCD 16×2 | PARTIAL | VM Lcd API, not bus timing |
| MQTT / virtual network | PARTIAL | Virtual broker panel + publish events (tested); no real broker |
| Waveform viewer | IMPLEMENTED | Output-pin history sparkline in workspace |
| IoT dashboard | PARTIAL | MQTT log + sensor chips; no historical charts service |
| All public + account pages | IMPLEMENTED | Routes verified in build + browser checks |
| Auth + project CRUD + versions + sharing (API) | IMPLEMENTED | FastAPI + pytest suite (`apps/api/tests`) |
| Project templates/examples (10) | IMPLEMENTED | `examples/` + per-example expected results; 9 fully, ESP32-MQTT partial |
| Responsive/mobile | PARTIAL | Pages responsive; precise editing is desktop-first |
| Light/dark themes | IMPLEMENTED | Theme toggle in Settings |
| Docker dev setup | IMPLEMENTED | `infra/docker-compose.yml`, API Dockerfile |
| AVR8js / RP2040js integration | NOT STARTED | Evaluated, documented path in technology-findings |
| Web Workers for simulation | NOT STARTED | Sim runs on the main thread in ≤10 ms slices; fine at this scale |
