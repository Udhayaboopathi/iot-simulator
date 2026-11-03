# Open-Source Dependencies

All runtime dependencies are MIT/Apache-2.0/ISC/BSD-compatible. No GPL code
is bundled. Versions are pinned by `package-lock.json` / `requirements.txt`.

| Package | Use | License | Source |
|---|---|---|---|
| react, react-dom | Web UI | MIT | https://github.com/facebook/react |
| react-router-dom | Routing | MIT | https://github.com/remix-run/react-router |
| zustand | App state (single circuit-graph store) | MIT | https://github.com/pmndrs/zustand |
| three | 3D editor (WebGL, OrbitControls) | MIT | https://github.com/mrdoob/three.js |
| lucide-react | Icons | ISC | https://github.com/lucide-icons/lucide |
| tailwindcss | Utility CSS | MIT | https://github.com/tailwindlabs/tailwindcss |
| vite | Build/dev server | MIT | https://github.com/vitejs/vite |
| vitest | Unit/integration tests | MIT | https://github.com/vitest-dev/vitest |
| typescript | Type checking | Apache-2.0 | https://github.com/microsoft/TypeScript |
| fastapi | Backend API | MIT | https://github.com/fastapi/fastapi |
| uvicorn | ASGI server | BSD-3-Clause | https://github.com/encode/uvicorn |
| pydantic | API validation | MIT | https://github.com/pydantic/pydantic |

## Evaluated but not bundled (with reasons)
| Candidate | License | Decision |
|---|---|---|
| wokwi/avr8js | MIT | Not yet integrated — needs a HEX build toolchain + peripheral bridging to the net solver. Documented next step; no binary-emulation claim is made meanwhile. |
| wokwi/rp2040js | MIT | Same as above. |
| wokwi/wokwi-elements | MIT | Not used — all component rendering here is original (SVG + Three.js primitives). |
| pfalstad/circuitjs1 | GPL | Not embedded (license obligations); an original MNA solver was written instead. |
| ngspice / WebSpice | BSD-like / various | Too heavy for this build's DC scope; MNA solver covers the tested behaviour. |
| microsoft/monaco-editor | MIT | Not bundled — its loader model is unreliable for offline/self-hosted use; a lightweight editor + real parser diagnostics ships instead (PARTIAL). |
| reactflow | MIT | Not used — circuit-specific pin/wire semantics implemented directly in SVG. |
| konvajs | MIT | Not used — SVG chosen for crisp text/hit-testing at this scale. |
| cyberbotics/webots | Apache-2.0 | Reference only (robotics, out of scope). |
| @react-three/fiber, drei | MIT | Not used — plain Three.js imperative scene management fits the graph-rebuild model. |

Attribution: third-party license texts ship with the installed packages under
`node_modules/`; this table is the project's dependency register.
