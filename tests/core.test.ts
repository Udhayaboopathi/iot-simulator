import { describe, it, expect } from "vitest";
import { parseProject, serializeProject, validateProject, emptyProject } from "../packages/project-schema/src/index.ts";
import { buildNets, generateNetlist, areConnected, validateCircuit, History, addWire } from "../packages/circuit-core/src/index.ts";
import { solveAnalog, ledCurrent, voltageDivider, rcCharge, Simulation } from "../packages/simulation-core/src/index.ts";
import { COMPONENTS, getDef } from "../packages/components-library/src/index.ts";
import { EXAMPLES, ledBlinkProject } from "../examples/index.ts";

describe("project schema", () => {
  it("serializes and parses a project round-trip", () => {
    const p = ledBlinkProject();
    const round = parseProject(serializeProject(p));
    expect(round.id).toBe(p.id);
    expect(round.components.length).toBe(p.components.length);
    expect(round.wires.length).toBe(p.wires.length);
    expect(round.files[0].content).toContain("digitalWrite");
  });
  it("rejects an invalid project", () => {
    expect(validateProject({ schemaVersion: 99 }).ok).toBe(false);
    expect(() => parseProject('{"schemaVersion":99}')).toThrow();
  });
  it("empty project is valid", () => { expect(validateProject(emptyProject("x", "X")).ok).toBe(true); });
});

describe("circuit core / netlist", () => {
  it("builds real nets from wires (LED circuit)", () => {
    const p = ledBlinkProject();
    expect(areConnected(p, { component: "uno1", pin: "D13" }, { component: "r1", pin: "1" })).toBe(true);
    expect(areConnected(p, { component: "led1", pin: "K" }, { component: "uno1", pin: "GND" })).toBe(true);
    expect(areConnected(p, { component: "led1", pin: "A" }, { component: "uno1", pin: "GND" })).toBe(false);
    const nets = generateNetlist(p);
    expect(nets.length).toBeGreaterThanOrEqual(3);
    expect(buildNets(p).size).toBeGreaterThan(0);
  });
  it("adding a wire changes connectivity; undo/redo restores it", () => {
    const p = emptyProject("t", "T");
    p.components.push(
      { id: "a", type: "resistor", label: "a", pos2d: { x: 0, y: 0 }, pos3d: { x: 0, y: 0, z: 0 }, rotation: 0, props: { resistance: 100 } },
      { id: "b", type: "resistor", label: "b", pos2d: { x: 100, y: 0 }, pos3d: { x: 100, y: 0, z: 0 }, rotation: 0, props: { resistance: 100 } },
    );
    const h = new History(p);
    const wired = addWire(p, { id: "w1", from: { component: "a", pin: "1" }, to: { component: "b", pin: "1" }, color: "#000" });
    h.push(wired);
    expect(areConnected(h.present, { component: "a", pin: "1" }, { component: "b", pin: "1" })).toBe(true);
    h.undo();
    expect(areConnected(h.present, { component: "a", pin: "1" }, { component: "b", pin: "1" })).toBe(false);
    h.redo();
    expect(areConnected(h.present, { component: "a", pin: "1" }, { component: "b", pin: "1" })).toBe(true);
  });
  it("warns when an LED has no series resistor", () => {
    const p = ledBlinkProject();
    p.wires = p.wires.filter((w) => w.to.component !== "r1" && w.from.component !== "r1");
    p.components = p.components.filter((c) => c.id !== "r1");
    p.wires.push({ id: "wx", from: { component: "uno1", pin: "D13" }, to: { component: "led1", pin: "A" }, color: "#000" });
    expect(validateCircuit(p).join(" ")).toMatch(/no current-limiting resistor/);
  });
});

describe("analog solver (MNA)", () => {
  it("voltage divider matches the textbook value", () => {
    expect(voltageDivider(5, 1000, 1000)).toBeCloseTo(2.5, 6);
    const sol = solveAnalog(["GND", "in", "mid"], [
      { a: "in", b: "mid", r: 1000 }, { a: "mid", b: "GND", r: 1000 },
    ], [{ id: "vs", plus: "in", minus: "GND", volts: 5 }]);
    expect(sol.nodeVoltage.get("mid")).toBeCloseTo(2.5, 4);
  });
  it("LED current through 220 ohm from 5 V is ~13.6 mA", () => {
    expect(ledCurrent(5, 2, 220) * 1000).toBeCloseTo(13.636, 2);
  });
  it("RC charge follows the exponential", () => {
    expect(rcCharge(0, 5, 1000, 100e-6, 0.1)).toBeCloseTo(5 * (1 - Math.exp(-1)), 4);
  });
  it("series resistors add up in the solver", () => {
    const sol = solveAnalog(["GND", "in", "a", "b"], [
      { a: "in", b: "a", r: 100 }, { a: "a", b: "b", r: 100 }, { a: "b", b: "GND", r: 100 },
    ], [{ id: "vs", plus: "in", minus: "GND", volts: 3 }]);
    expect(sol.nodeVoltage.get("a")).toBeCloseTo(2, 4);
    expect(sol.nodeVoltage.get("b")).toBeCloseTo(1, 4);
  });
});

describe("simulation engine + sketch VM", () => {
  it("AVR LED blink: GPIO D13 toggles the LED with a 1 s period and real current", () => {
    const p = ledBlinkProject();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.start();
    sim.tick(100); // inside first HIGH phase
    let st = sim.states.get("led1");
    expect(st?.on).toBe(true);
    expect(st!.currentMa!).toBeGreaterThan(10);
    expect(st!.currentMa!).toBeLessThan(17);
    sim.tick(1000); // now in LOW phase (t≈1100)
    st = sim.states.get("led1");
    expect(st?.on).toBe(false);
    sim.tick(1000); // HIGH again (t≈2100)
    st = sim.states.get("led1");
    expect(st?.on).toBe(true);
    const serial = sim.events.filter((e) => e.kind === "serial").map((e) => e.text).join("");
    expect(serial).toContain("LED ON");
    expect(serial).toContain("LED OFF");
  });
  it("reset returns the simulation to t=0 with outputs cleared", () => {
    const p = ledBlinkProject();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(500);
    sim.reset();
    expect(sim.timeMs).toBe(0);
    expect(sim.outputs.size).toBe(0);
  });
  it("button input drives the LED only while pressed", () => {
    const ex = EXAMPLES.find((e) => e.id === "button-led")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(50);
    expect(sim.states.get("led1")?.on).toBe(false);
    sim.setProp("btn1", "pressed", true);
    sim.tick(50);
    expect(sim.states.get("led1")?.on).toBe(true);
    sim.setProp("btn1", "pressed", false);
    sim.tick(50);
    expect(sim.states.get("led1")?.on).toBe(false);
  });
  it("DHT22 readings reach Serial from the sensor props", () => {
    const ex = EXAMPLES.find((e) => e.id === "dht22-display")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(100);
    const serial = sim.events.filter((e) => e.kind === "serial").map((e) => e.text).join("");
    expect(serial).toContain("28");
    expect(serial).toContain("55");
  });
  it("ultrasonic pulseIn converts the inspector distance to cm", () => {
    const ex = EXAMPLES.find((e) => e.id === "ultrasonic")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(100);
    const serial = sim.events.filter((e) => e.kind === "serial").map((e) => e.text).join("");
    expect(serial).toContain("Distance: 25 cm");
  });
  it("servo angle follows Servo.write in the sketch", () => {
    const ex = EXAMPLES.find((e) => e.id === "servo-control")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(300);
    const angle = sim.states.get("servo1")?.angle ?? 0;
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThanOrEqual(180);
  });
  it("AND-gate example only lights when both switches are on", () => {
    const ex = EXAMPLES.find((e) => e.id === "logic-and")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.solve();
    expect(sim.states.get("led1")?.on).toBe(false); // swA off, swB on
    sim.setProp("swA", "on", true);
    sim.solve();
    expect(sim.states.get("led1")?.on).toBe(true);
  });
  it("ESP32 MQTT example publishes telemetry events", () => {
    const ex = EXAMPLES.find((e) => e.id === "esp32-mqtt")!;
    const p = ex.make();
    const sim = new Simulation(p);
    sim.loadFirmware(p.files[0].content);
    sim.tick(100);
    const mqtt = sim.events.filter((e) => e.kind === "mqtt");
    expect(mqtt.length).toBeGreaterThan(0);
    expect(mqtt[0].text).toContain("iot/room1/temperature");
  });
  it("every example project validates and has a working netlist", () => {
    for (const ex of EXAMPLES) {
      const p = ex.make();
      expect(validateProject(p).ok, ex.id).toBe(true);
      expect(generateNetlist(p).length, ex.id).toBeGreaterThan(0);
    }
  });
});

describe("component library", () => {
  it("has the target boards and categories, with honest simulated flags", () => {
    for (const id of ["arduino-uno", "arduino-nano", "arduino-mega", "esp32-devkit", "raspberry-pi-pico", "led", "dht22", "hc-sr04", "servo", "lcd1602"]) {
      expect(() => getDef(id)).not.toThrow();
    }
    expect(getDef("mpu6050").simulated).toBe(false); // not labelled simulated until implemented
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(25);
    for (const c of COMPONENTS) expect(c.pins.length).toBeGreaterThan(0);
  });
});
