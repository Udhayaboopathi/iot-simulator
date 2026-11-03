import React, { useMemo, useRef, useState } from "react";
import { getDef } from "../../../../packages/components-library/src/index.ts";
import { buildNets, pinKey } from "../../../../packages/circuit-core/src/index.ts";
import { useStore } from "../store.ts";

type PinRef = { component: string; pin: string };
const WIRE_COLORS_OK = "#43a047";

export default function Editor2D() {
  const { project, sim, selected, setSelected, moveComponent, addWire, setProp, running } = useStore();
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [pending, setPending] = useState<PinRef | null>(null);
  const [hoverNet, setHoverNet] = useState<Set<string> | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nets = useMemo(() => buildNets(project), [project]);
  const netOfPin = (c: string, p: string) => {
    const key = pinKey(c, p);
    for (const members of nets.values()) if (members.includes(key)) return new Set(members);
    return new Set([key]);
  };
  const toWorld = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left - view.x) / view.k, y: (e.clientY - rect.top - view.y) / view.k };
  };
  const pinPos = (compId: string, pinId: string) => {
    const c = project.components.find((x) => x.id === compId)!;
    const def = getDef(c.type);
    const pin = def.pins.find((p) => p.id === pinId)!;
    const rad = ((c.rotation ?? 0) * Math.PI) / 180;
    const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
    const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
    return { x: c.pos2d.x + rx, y: c.pos2d.y + ry };
  };
  const onPinClick = (e: React.MouseEvent, ref: PinRef) => {
    e.stopPropagation();
    if (!pending) { setPending(ref); return; }
    if (pending.component === ref.component && pending.pin === ref.pin) { setPending(null); return; }
    addWire(pending, ref);
    setPending(null);
  };
  return (
    <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none", background: "var(--panel)" }}
      onPointerMove={(e) => {
        const w = toWorld(e); setMouse(w);
        if (drag.current) moveComponent(drag.current.id, w.x - drag.current.dx, w.y - drag.current.dy);
        if (pan.current) setView((v) => ({ ...v, x: pan.current!.vx + (e.clientX - pan.current!.sx), y: pan.current!.vy + (e.clientY - pan.current!.sy) }));
      }}
      onPointerUp={() => { drag.current = null; pan.current = null; }}
      onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.grid) { setSelected(null); pan.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; } }}
      onWheel={(e) => { const f = e.deltaY < 0 ? 1.1 : 0.9; setView((v) => ({ ...v, k: Math.min(3, Math.max(0.25, v.k * f)) })); }}
    >
      <defs>
        <pattern id="grid" width={20 * view.k} height={20 * view.k} patternUnits="userSpaceOnUse" x={view.x % (20 * view.k)} y={view.y % (20 * view.k)}>
          <path d={`M ${20 * view.k} 0 L 0 0 0 ${20 * view.k}`} fill="none" stroke="var(--line)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect data-grid="1" x={0} y={0} width="100%" height="100%" fill="url(#grid)" />
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {project.wires.map((w) => {
          const a = pinPos(w.from.component, w.from.pin); const b = pinPos(w.to.component, w.to.pin);
          const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 24 };
          const inHover = hoverNet?.has(pinKey(w.from.component, w.from.pin));
          return <path key={w.id} d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`} fill="none" stroke={inHover ? "#ffb300" : w.color} strokeWidth={inHover ? 4 : 2.6} strokeLinecap="round" style={{ pointerEvents: "none" }} />;
        })}
        {pending && (() => { const a = pinPos(pending.component, pending.pin); return <line x1={a.x} y1={a.y} x2={mouse.x} y2={mouse.y} stroke={WIRE_COLORS_OK} strokeDasharray="5 4" strokeWidth={2} />; })()}
        {project.components.map((c) => {
          const def = getDef(c.type);
          const st = sim.states.get(c.id);
          const isSel = selected === c.id;
          const isLed = def.behavior === "led";
          const ledColor = isLed ? String(c.props.color ?? def.color3d) : def.color3d;
          const fill = isLed && st?.on ? ledColor : def.behavior === "mcu" ? def.color3d : "var(--panel)";
          return (
            <g key={c.id} transform={`translate(${c.pos2d.x},${c.pos2d.y}) rotate(${c.rotation ?? 0})`}
              onPointerDown={(e) => { e.stopPropagation(); setSelected(c.id); const w = toWorld(e); drag.current = { id: c.id, dx: w.x - c.pos2d.x, dy: w.y - c.pos2d.y }; }}
              onClick={() => {
                if (def.behavior === "button") setProp(c.id, "pressed", !c.props.pressed, true);
                if (def.behavior === "switch") setProp(c.id, "on", !c.props.on, true);
              }}
              style={{ cursor: "grab" }}>
              <rect x={-4} y={-4} width={def.width + 8} height={def.height + 8} rx={10} fill="none" stroke={isSel ? "var(--brand)" : "transparent"} strokeWidth={2} />
              <rect x={0} y={0} width={def.width} height={def.height} rx={8} fill={fill} fillOpacity={isLed && st?.on ? 0.95 : def.behavior === "mcu" ? 1 : 0.55} stroke="var(--muted)" strokeWidth={1.2} />
              {def.behavior === "seven-seg" && st?.segments && (
                <text x={def.width / 2} y={def.height / 2 + 10} textAnchor="middle" fontSize={34} fontWeight={800} fill="#ff5252">
                  {["1111110", "0110000", "1101101", "1111001", "0110011", "1011011", "1011111", "1110000", "1111111", "1111011"].indexOf(["a", "b", "c", "d", "e", "f", "g"].map((s) => (st.segments![s] ? "1" : "0")).join("")) >= 0
                    ? ["1111110", "0110000", "1101101", "1111001", "0110011", "1011011", "1011111", "1110000", "1111111", "1111011"].indexOf(["a", "b", "c", "d", "e", "f", "g"].map((s) => (st.segments![s] ? "1" : "0")).join(""))
                    : "–"}
                </text>
              )}
              {def.behavior === "lcd" && <text x={8} y={30} fontSize={13} fontFamily="ui-monospace,monospace" fill={st?.text ? "#123" : "var(--muted)"}>{(st?.text ?? "LCD 16x2").slice(0, 32)}</text>}
              {def.behavior === "servo" && <text x={def.width / 2} y={def.height / 2 + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)">{Math.round(st?.angle ?? Number(c.props.angle ?? 0))}°</text>}
              {def.behavior === "buzzer" && st?.on && <text x={def.width / 2} y={-8} textAnchor="middle" fontSize={13}>♪</text>}
              <text x={def.width / 2} y={-8} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">{c.label}</text>
              <text x={def.width / 2} y={def.height + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">{def.name}{st?.currentMa !== undefined ? ` · ${st.currentMa.toFixed(1)} mA` : ""}{def.behavior === "dc-motor" && st?.speed !== undefined ? ` · ${Math.round(st.speed * 100)}%` : ""}</text>
              {def.pins.map((p) => {
                const key = pinKey(c.id, p.id);
                const inNet = hoverNet?.has(key);
                const isPending = pending?.component === c.id && pending?.pin === p.id;
                return (
                  <g key={p.id} transform={`translate(${p.x},${p.y})`}
                    onMouseEnter={() => setHoverNet(netOfPin(c.id, p.id))}
                    onMouseLeave={() => setHoverNet(null)}
                    onClick={(e) => onPinClick(e, { component: c.id, pin: p.id })}
                    style={{ cursor: "crosshair" }}>
                    <circle r={9} fill="transparent" />
                    <circle r={isPending ? 6 : 4.2} fill={isPending ? WIRE_COLORS_OK : inNet ? "#ffb300" : p.kind === "ground" ? "#222" : p.kind === "power" ? "#e53935" : "#fb8c00"} stroke="#fff" strokeWidth={1.2} />
                    <text y={-9} textAnchor="middle" fontSize={8.5} fill="var(--muted)">{p.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
      <text x={10} y={20} fontSize={12} fill="var(--muted)">{running ? "● simulating" : "2D editor"} — click a pin, then another pin to wire · drag parts · scroll to zoom · drag background to pan</text>
    </svg>
  );
}
