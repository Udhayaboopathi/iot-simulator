# Reference Analysis — publicly observable behaviour (2026-11-03)

Method: REA MCP (list_browser_targets against a locally bound CDP endpoint,
see rea-evidence.md) + direct reading of the public landing pages. No login,
paywall or access-control bypass was attempted. Only publicly observable
layout/workflow facts were recorded; no proprietary code or assets were copied.

## Wokwi (wokwi.com)
Observed (landing + project URL loaded in a real Chromium target):
- Positions itself as an ESP32/Arduino/RP2040 browser simulator.
- Workflow centre: a project page combining a code editor, a diagram
  (2D parts + wires) and simulation controls (start/stop), with a parts
  library and shareable project URLs.
- Featured/community projects on the landing page; classroom offering.
Reproduced equivalents: workspace with code editor + diagram + run controls,
component library, example gallery, shareable/exportable project JSON.
Hypotheses (not directly observed in this session): exact internal diagram
JSON format and part rendering internals — not needed and not copied.

## Tinkercad (tinkercad.com)
Observed (landing):
- Three product pillars presented side by side: 3D Design, Circuits,
  Codeblocks. Circuits flow: drag parts onto a breadboard-style workplane,
  wire them, press a simulation start, learn via guided projects.
- Strong education framing, gallery of community designs.
Reproduced equivalents: drag-and-drop circuit workbench, guided tutorials
page, examples gallery, beginner-first landing structure.

## Tinkered (tinkered.ai)
Observed (landing):
- AI-assisted hardware design: describe a device → circuit + firmware +
  3D simulation kept in one connected project.
- Board catalogue emphasis (Arduino, ESP32, Pico, STM32…), interactive 3D
  board models with "drag to rotate · scroll to zoom".
Reproduced equivalents: interactive 3D component view with orbit/zoom,
board library breadth, circuit+firmware kept in one project model.
Not reproduced: AI generation of circuits/firmware (out of scope; not claimed).

## Webots Cloud (webots.cloud)
Observed (landing):
- Cloud-hosted 3D robotics simulation: public simulation catalogue with
  thumbnails, versions, sizes; simulations and competitions lists; worlds
  run in the browser.
Reproduced equivalents: 3D-first presentation patterns (catalogue + run in
browser), 3D scene with camera presets. Robotics physics is out of scope for
an electronics simulator and is not claimed.

## Cross-cutting patterns adopted
- IDE-style workspace: library (left) · canvas (centre) · inspector (right) ·
  output/serial (bottom), run/pause/stop/reset + speed controls.
- Example-first onboarding: every headline workflow ships as a runnable example.
- Capability honesty: reference products market broad compatibility; this
  product instead labels every component simulated / partial / definition-only.
