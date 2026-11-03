import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getDef } from "../../../../packages/components-library/src/index.ts";
import { useStore } from "../store.ts";

/** 3D view of the SAME circuit graph as the 2D editor. Positions come from
 *  component.pos3d (kept in sync with pos2d by the store), pin metadata is the
 *  same PinDef list, and live colours/angles come from the shared Simulation. */
export default function Editor3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ renderer?: THREE.WebGLRenderer; scene?: THREE.Scene; camera?: THREE.PerspectiveCamera; controls?: OrbitControls; groups: Map<string, THREE.Group>; ledMats: Map<string, THREE.MeshStandardMaterial>; horns: Map<string, THREE.Mesh>; wheels: Map<string, THREE.Mesh>; lcdTex: Map<string, THREE.Mesh>; raf: number }>({ groups: new Map(), ledMats: new Map(), horns: new Map(), wheels: new Map(), lcdTex: new Map(), raf: 0 });
  const project = useStore((s) => s.project);
  const projectRef = useRef(project); projectRef.current = project;

  useEffect(() => {
    const mount = mountRef.current!;
    const S = stateRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1626);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(560, 520, 760);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(280, 0, 180);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(300, 500, 200); sun.castShadow = true; scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1200), new THREE.MeshStandardMaterial({ color: 0x16233c }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(300, -6, 220); ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(1400, 70, 0x2b4a77, 0x1d3357); grid.position.set(300, -5, 220); scene.add(grid);
    Object.assign(S, { renderer, scene, camera, controls });
    const resize = () => { const w = mount.clientWidth, h = mount.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);
    const animate = () => {
      S.raf = requestAnimationFrame(animate);
      const sim = useStore.getState().sim;
      for (const [id, mat] of S.ledMats) {
        const st = sim.states.get(id);
        const b = st?.brightness ?? 0;
        mat.emissiveIntensity = b * 2.4;
      }
      for (const [id, horn] of S.horns) { const st = sim.states.get(id); horn.rotation.z = THREE.MathUtils.degToRad(90 - (st?.angle ?? 0)); }
      for (const [id, wheel] of S.wheels) { const st = sim.states.get(id); wheel.rotation.x += (st?.speed ?? 0) * 0.4; }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => { cancelAnimationFrame(S.raf); ro.disconnect(); renderer.dispose(); mount.removeChild(renderer.domElement); };
  }, []);

  // Rebuild the scene graph whenever the circuit graph changes.
  useEffect(() => {
    const S = stateRef.current; if (!S.scene) return;
    for (const g of S.groups.values()) S.scene.remove(g);
    S.groups.clear(); S.ledMats.clear(); S.horns.clear(); S.wheels.clear(); S.lcdTex.clear();
    const p = project;
    for (const c of p.components) {
      const def = getDef(c.type);
      const g = new THREE.Group();
      const scale = 1;
      const w = def.width * scale, d = def.height * scale;
      const isBoard = def.shape3d === "board" || def.shape3d === "breadboard";
      const h = isBoard ? 4 : def.shape3d === "cylinder" || def.shape3d === "disc" ? 16 : 14;
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.behavior === "led" ? String(c.props.color ?? def.color3d) : def.color3d), roughness: 0.55, metalness: 0.08 });
      let body: THREE.Mesh;
      if (def.shape3d === "cylinder" || def.shape3d === "disc") {
        body = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h, 28), mat);
        body.position.y = h / 2;
      } else {
        body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.y = h / 2;
      }
      body.castShadow = true; body.receiveShadow = true;
      if (def.behavior === "led" || def.behavior === "rgb-led") { mat.emissive = new THREE.Color(String(c.props.color ?? "#ff2222")); mat.emissiveIntensity = 0; S.ledMats.set(c.id, mat); }
      g.add(body);
      if (def.behavior === "servo") {
        const horn = new THREE.Mesh(new THREE.BoxGeometry(46, 5, 10), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }));
        horn.position.y = h + 4; S.horns.set(c.id, horn); g.add(horn);
      }
      if (def.behavior === "dc-motor") {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 6, 24), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(0, h + 10, 0); S.wheels.set(c.id, wheel); g.add(wheel);
      }
      // pins as hit-target spheres using the shared PinDef metadata
      for (const pin of def.pins) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 10), new THREE.MeshStandardMaterial({ color: pin.kind === "ground" ? 0x111111 : pin.kind === "power" ? 0xe53935 : 0xffb300 }));
        s.position.set(pin.x - w / 2, h + 2, pin.y - d / 2);
        s.userData = { component: c.id, pin: pin.id };
        g.add(s);
      }
      g.position.set(c.pos3d.x, 0, c.pos3d.z);
      g.rotation.y = THREE.MathUtils.degToRad(-(c.rotation ?? 0));
      S.groups.set(c.id, g);
      S.scene.add(g);
    }
    // wires as 3D lines between the same pins the 2D editor uses
    const pinWorld = (compId: string, pinId: string) => {
      const c = p.components.find((x) => x.id === compId)!; const def = getDef(c.type);
      const pin = def.pins.find((x) => x.id === pinId)!;
      return new THREE.Vector3(c.pos3d.x + pin.x - def.width / 2, 26, c.pos3d.z + pin.y - def.height / 2);
    };
    for (const w of p.wires) {
      try {
        const a = pinWorld(w.from.component, w.from.pin); const b = pinWorld(w.to.component, w.to.pin);
        const mid = a.clone().lerp(b, 0.5); mid.y = 46;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.TubeGeometry(curve, 20, 1.5, 6);
        const line = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(w.color === "#ffffff" ? "#cccccc" : w.color) }));
        const grp = new THREE.Group(); grp.add(line);
        S.groups.set(`wire:${w.id}`, grp); S.scene.add(grp);
      } catch { /* wire to a removed pin */ }
    }
  }, [project]);

  // selection highlight + click-to-select via raycasting; view preset buttons exposed on window for the toolbar
  useEffect(() => {
    const S = stateRef.current; if (!S.renderer || !S.camera) return;
    const dom = S.renderer.domElement;
    const onClick = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, S.camera!);
      const hits = ray.intersectObjects([...S.groups.values()], true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) { const id = [...S.groups.entries()].find(([, g]) => g === o)?.[0]; if (id && !id.startsWith("wire:")) { useStore.getState().setSelected(id); return; } o = o.parent; }
        if (h.object.userData.component) { useStore.getState().setSelected(h.object.userData.component); return; }
      }
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [project]);

  const setCam = (preset: "iso" | "top" | "front") => {
    const S = stateRef.current; if (!S.camera || !S.controls) return;
    if (preset === "iso") S.camera.position.set(560, 520, 760);
    if (preset === "top") S.camera.position.set(280, 900, 181);
    if (preset === "front") S.camera.position.set(280, 120, 900);
    S.controls.target.set(280, 0, 180);
  };
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
        <button className="btn sm" onClick={() => setCam("iso")}>Isometric</button>
        <button className="btn sm" onClick={() => setCam("top")}>Top</button>
        <button className="btn sm" onClick={() => setCam("front")}>Front</button>
      </div>
      <div style={{ position: "absolute", left: 8, bottom: 8 }} className="chip">3D — drag to orbit · scroll to zoom · click a part to select</div>
    </div>
  );
}
