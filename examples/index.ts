import type { Project, ComponentInstance, Wire } from "../packages/project-schema/src/index.ts";

let n = 0;
const C = (type: string, x: number, y: number, props: ComponentInstance["props"] = {}, id?: string): ComponentInstance => {
  n += 1;
  const auto = `${type.split("-")[0]}${n}`;
  return { id: id ?? auto, type, label: id ?? auto, pos2d: { x, y }, pos3d: { x, y: 0, z: y }, rotation: 0, props };
};
const W = (fc: string, fp: string, tc: string, tp: string, color = "#e53935"): Wire => ({ id: `w_${fc}${fp}_${tc}${tp}_${Math.random().toString(36).slice(2, 7)}`, from: { component: fc, pin: fp }, to: { component: tc, pin: tp }, color });
const base = (id: string, name: string, description: string, board: string): Project => ({
  schemaVersion: 1, id, name, description, board, components: [], wires: [],
  files: [{ name: "sketch.ino", language: "cpp", content: "" }],
  settings: { gridSize: 10, supplyVoltage: 5 },
  createdAt: "2026-11-03T00:00:00.000Z", updatedAt: "2026-11-03T00:00:00.000Z",
});
function ledCircuit(p: Project, pin: string, ledId: string, resId: string, x: number, y: number, color = "#ff2222") {
  p.components.push(C("led", x, y, { color }, ledId), C("resistor", x, y + 80, { resistance: 220 }, resId));
  p.wires.push(W("uno1", pin, resId, "1"), W(resId, "2", ledId, "A"), W(ledId, "K", "uno1", "GND", "#222"));
}

export const LED_BLINK_CODE = `// Arduino LED blink — D13 drives an LED through a 220 ohm resistor.
void setup() {
  pinMode(D13, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(D13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(D13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
`;
export function ledBlinkProject(): Project {
  n = 0;
  const p = base("led-blink", "Arduino LED Blink", "The hello-world of hardware: an Arduino Uno blinks an LED on D13 every second. Run it and watch the same state in 2D and 3D.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"));
  p.wires.push(W("uno1", "5V", "uno1", "5V", "#c00")); p.wires.pop(); // (no self wire)
  ledCircuit(p, "D13", "led1", "r1", 340, 60);
  p.files[0].content = LED_BLINK_CODE;
  return p;
}

export function trafficLightProject(): Project {
  n = 0;
  const p = base("traffic-light", "Traffic Light Controller", "Red → red+amber → green → amber, timed by the sketch.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"));
  ledCircuit(p, "D8", "ledR", "rR", 340, 20, "#ff2222");
  ledCircuit(p, "D9", "ledY", "rY", 340, 140, "#ffbb00");
  ledCircuit(p, "D10", "ledG", "rG", 340, 260, "#22cc44");
  p.files[0].content = `void setup() { pinMode(D8, OUTPUT); pinMode(D9, OUTPUT); pinMode(D10, OUTPUT); }
void loop() {
  digitalWrite(D8, HIGH); digitalWrite(D9, LOW); digitalWrite(D10, LOW); delay(2000);
  digitalWrite(D9, HIGH); delay(600);
  digitalWrite(D8, LOW); digitalWrite(D9, LOW); digitalWrite(D10, HIGH); delay(2000);
  digitalWrite(D10, LOW); digitalWrite(D9, HIGH); delay(600);
}
`;
  return p;
}

export function buttonLedProject(): Project {
  n = 0;
  const p = base("button-led", "Push-Button LED Control", "Press the button (click it in 2D or 3D) and the LED follows D2.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("push-button", 360, 200, { pressed: false }, "btn1"));
  ledCircuit(p, "D13", "led1", "r1", 340, 40);
  p.wires.push(W("uno1", "5V", "btn1", "1", "#c00"), W("btn1", "2", "uno1", "D2", "#2277cc"));
  p.files[0].content = `void setup() { pinMode(D13, OUTPUT); pinMode(D2, INPUT); }
void loop() {
  int state = digitalRead(D2);
  digitalWrite(D13, state);
}
`;
  return p;
}

export function dhtProject(): Project {
  n = 0;
  const p = base("dht22-display", "DHT22 Temperature & Humidity", "Reads a DHT22 on D2 and prints readings to Serial every 2 s. Change temperature/humidity in the inspector while it runs.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("dht22", 360, 80, { temperature: 28, humidity: 55 }, "dht1"));
  p.wires.push(W("uno1", "5V", "dht1", "VCC", "#c00"), W("dht1", "DATA", "uno1", "D2", "#ff9800"), W("dht1", "GND", "uno1", "GND", "#222"));
  p.files[0].content = `DHT dht(D2, DHT22);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.print("Temp: "); Serial.print(t); Serial.print(" C  Humidity: "); Serial.print(h); Serial.println(" %");
  delay(2000);
}
`;
  return p;
}

export function ultrasonicProject(): Project {
  n = 0;
  const p = base("ultrasonic", "Ultrasonic Distance Measurement", "HC-SR04 on TRIG D9 / ECHO D10. pulseIn() returns echo microseconds; distance = us / 58. Drag the distance slider in the inspector.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("hc-sr04", 360, 80, { distanceCm: 25 }, "us1"));
  p.wires.push(W("uno1", "5V", "us1", "VCC", "#c00"), W("us1", "TRIG", "uno1", "D9", "#2277cc"), W("us1", "ECHO", "uno1", "D10", "#2e7d32"), W("us1", "GND", "uno1", "GND", "#222"));
  p.files[0].content = `void setup() { Serial.begin(9600); pinMode(D9, OUTPUT); pinMode(D10, INPUT); }
void loop() {
  digitalWrite(D9, LOW); delay(1);
  digitalWrite(D9, HIGH); delay(1);
  digitalWrite(D9, LOW);
  long us = pulseIn(D10, HIGH);
  long cm = us / 58;
  Serial.print("Distance: "); Serial.print(cm); Serial.println(" cm");
  delay(500);
}
`;
  return p;
}

export function servoProject(): Project {
  n = 0;
  const p = base("servo-control", "Servo Motor Control", "An SG90 sweeps 0→180→0. Watch the horn rotate in 3D.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("servo", 360, 80, {}, "servo1"));
  p.wires.push(W("uno1", "5V", "servo1", "VCC", "#c00"), W("servo1", "SIG", "uno1", "D9", "#ff9800"), W("servo1", "GND", "uno1", "GND", "#222"));
  p.files[0].content = `Servo sweep;
void setup() { sweep.attach(D9); }
void loop() {
  for (int a = 0; a <= 180; a += 10) { sweep.write(a); delay(120); }
  for (int a = 180; a >= 0; a -= 10) { sweep.write(a); delay(120); }
}
`;
  return p;
}

export function lcdProject(): Project {
  n = 0;
  const p = base("lcd1602", "LCD 16x2 Display", "Prints a greeting and a live seconds counter to the I2C LCD.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("lcd1602", 340, 80, {}, "lcd1"));
  p.wires.push(W("uno1", "5V", "lcd1", "VCC", "#c00"), W("lcd1", "GND", "uno1", "GND", "#222"), W("lcd1", "SDA", "uno1", "A4", "#2277cc"), W("lcd1", "SCL", "uno1", "A5", "#2e7d32"));
  p.files[0].content = `LiquidCrystal_I2C lcd(0x27, 16, 2);
int secs = 0;
void setup() { lcd.init(); lcd.backlight(); lcd.print("Hello, IoT Sim!"); }
void loop() { secs += 1; lcd.clear(); lcd.print("Uptime s: "); lcd.print(secs); delay(1000); }
`;
  return p;
}

export function rgbLedProject(): Project {
  n = 0;
  const p = base("rgb-led", "RGB LED Control", "PWM on D9/D10/D11 mixes colours; the 3D LED glows with the mixed colour.", "arduino-uno");
  p.components.push(C("arduino-uno", 40, 60, {}, "uno1"), C("rgb-led", 360, 80, {}, "rgb1"),
    C("resistor", 300, 200, { resistance: 220 }, "rR"), C("resistor", 360, 200, { resistance: 220 }, "rG"), C("resistor", 420, 200, { resistance: 220 }, "rB"));
  p.wires.push(W("uno1", "D9", "rR", "1"), W("rR", "2", "rgb1", "R"), W("uno1", "D10", "rG", "1"), W("rG", "2", "rgb1", "G"), W("uno1", "D11", "rB", "1"), W("rB", "2", "rgb1", "B"), W("rgb1", "K", "uno1", "GND", "#222"));
  p.files[0].content = `void setup() { pinMode(D9, OUTPUT); pinMode(D10, OUTPUT); pinMode(D11, OUTPUT); }
void loop() {
  analogWrite(D9, 255); analogWrite(D10, 0); analogWrite(D11, 0); delay(800);
  analogWrite(D9, 0); analogWrite(D10, 255); analogWrite(D11, 0); delay(800);
  analogWrite(D9, 0); analogWrite(D10, 0); analogWrite(D11, 255); delay(800);
}
`;
  return p;
}

export function logicProject(): Project {
  n = 0;
  const p = base("logic-and", "Digital Logic — AND Gate", "Two switches feed a 74HC08 AND gate; the LED lights only when both are on. Toggle switches in the inspector.", "arduino-uno");
  p.components.push(C("slide-switch", 40, 40, { on: false }, "swA"), C("slide-switch", 40, 140, { on: true }, "swB"),
    C("logic-and", 220, 80, { gate: "AND" }, "gate1"), C("led", 400, 80, { color: "#22cc44" }, "led1"), C("resistor", 400, 180, { resistance: 220 }, "r1"), C("power-supply", 40, 260, { voltage: 5 }, "psu1"));
  p.wires.push(W("psu1", "VCC", "swA", "1", "#c00"), W("psu1", "VCC", "swB", "1", "#c00"), W("swA", "COM", "gate1", "A", "#2277cc"), W("swB", "COM", "gate1", "B", "#2e7d32"),
    W("psu1", "VCC", "gate1", "VCC", "#c00"), W("gate1", "GND", "psu1", "GND", "#222"), W("gate1", "Y", "r1", "1", "#ff9800"), W("r1", "2", "led1", "A"), W("led1", "K", "psu1", "GND", "#222"));
  p.files[0].content = "// No firmware: this circuit is pure hardware logic.\nvoid setup() {}\nvoid loop() {}\n";
  return p;
}

export function esp32MqttProject(): Project {
  n = 0;
  const p = base("esp32-mqtt", "ESP32 MQTT Temperature Telemetry", "Virtual-network example: the sketch VM publishes DHT readings to the in-app virtual MQTT broker panel every 2 s. Marked PARTIAL — no Xtensa emulation (see KNOWN_LIMITATIONS).", "esp32-devkit");
  p.components.push(C("esp32-devkit", 40, 60, {}, "esp1"), C("dht22", 340, 80, { temperature: 29, humidity: 60 }, "dht1"));
  p.components[0].id = "esp1";
  p.wires.push(W("esp1", "3V3", "dht1", "VCC", "#c00"), W("dht1", "DATA", "esp1", "GPIO15", "#ff9800"), W("dht1", "GND", "esp1", "GND", "#222"));
  // keep the MCU id consistent for the engine
  p.files[0].content = `DHT dht(GPIO15, DHT22);
void setup() { Serial.begin(115200); dht.begin(); mqtt.connect(); }
void loop() {
  float t = dht.readTemperature();
  Serial.print("Publishing temp: "); Serial.println(t);
  mqtt.publish("iot/room1/temperature", t);
  delay(2000);
}
`;
  return p;
}

export const EXAMPLES: { id: string; make: () => Project; expected: string }[] = [
  { id: "led-blink", make: ledBlinkProject, expected: "LED on D13 turns ON for 1000 ms, OFF for 1000 ms, repeating; Serial prints LED ON / LED OFF; LED current ≈ 13.6 mA through 220 Ω." },
  { id: "traffic-light", make: trafficLightProject, expected: "Red 2 s → red+amber 0.6 s → green 2 s → amber 0.6 s, repeating." },
  { id: "button-led", make: buttonLedProject, expected: "LED mirrors the push-button state on D2." },
  { id: "dht22-display", make: dhtProject, expected: "Serial prints the inspector-set temperature and humidity every 2 s." },
  { id: "ultrasonic", make: ultrasonicProject, expected: "Serial prints Distance = echo µs / 58 cm, matching the inspector distance." },
  { id: "servo-control", make: servoProject, expected: "Servo angle sweeps 0→180→0 in 10° steps every 120 ms." },
  { id: "lcd1602", make: lcdProject, expected: "LCD shows a greeting, then an uptime counter updating every second." },
  { id: "rgb-led", make: rgbLedProject, expected: "LED cycles red → green → blue every 800 ms." },
  { id: "logic-and", make: logicProject, expected: "Output LED lights only when both switches are on." },
  { id: "esp32-mqtt", make: esp32MqttProject, expected: "PARTIAL: virtual MQTT panel receives iot/room1/temperature every 2 s (sketch VM, not Xtensa emulation)." },
];
