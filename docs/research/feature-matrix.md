# Feature Matrix — reference patterns vs this product

| Capability | Wokwi | Tinkercad Circuits | Tinkered | Webots Cloud | This product |
|---|---|---|---|---|---|
| 2D circuit editor | Yes | Yes | Yes | No | Yes (SVG, pin-aware wiring, real nets) |
| 3D view of same circuit | No (2D parts) | 3D design is separate | Yes | Yes (robotics) | Yes — same graph, Three.js |
| Firmware execution | Yes (real emulation) | Yes (simulated) | Yes | Controllers | Partial — Arduino-subset sketch VM (documented) |
| Analog solving | Partial | Yes | n/a | n/a | Yes — MNA DC solver, tested vs textbook values |
| Sensors/actuators library | Yes | Yes | Yes | Robotics | 30 definitions, 27 simulated |
| Serial monitor | Yes | Yes | Yes | Console | Yes |
| IoT / MQTT | Yes | No | Partial | No | Partial — virtual broker panel |
| Project sharing | Yes | Yes | Yes | Yes | Yes — API visibility + JSON export |
| Examples/gallery | Yes | Yes | Yes | Yes | Yes — 10 runnable examples |
| Binary MCU emulation (AVR8js/RP2040js) | Yes | No | Yes | n/a | Not yet — integration path documented |

Full self-assessment with evidence: `FEATURE_PARITY_MATRIX.md`.
