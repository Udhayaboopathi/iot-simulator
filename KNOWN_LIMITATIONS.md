# Known Limitations — read before trusting a result

1. **Firmware is a sketch VM, not binary MCU emulation.** Sketches execute
   from source through an Arduino-subset interpreter (documented API surface
   in the workspace Code tab). There is no AVR/RP2040/Xtensa instruction
   emulation yet: no `.hex` loading, no register-level peripherals, no
   interrupts, no precise cycle timing. avr8js/rp2040js (both MIT) are the
   evaluated next step. ESP32 and Pico boards therefore run the same sketch
   VM for GPIO-level behaviour and are labelled PARTIAL.
2. **Analog scope is DC operating point + helpers.** The MNA solver covers
   resistive networks, dividers, potentiometers, LDRs and LED/diode forward
   models. Capacitors use an RC charge helper only; inductors are DC shorts
   in examples and the standalone inductor component is *definition only*.
   No AC/transient SPICE, no semiconductor gain curves (the NPN is an ideal
   switch model).
3. **Displays:** LCD 16×2 is driven through the VM's `lcd.print()` API, not
   raw HD44780 bus timing. The SSD1306 OLED and MPU6050 IMU are component
   *definitions only* — pins and 3D shapes exist, behaviour does not, and the
   UI says so.
4. **Networking is a virtual boundary.** `mqtt.publish` events land in the
   in-app virtual broker panel. No real Wi-Fi, broker, or HTTP exists, and
   firmware can never reach a real network.
5. **Code editor is not Monaco.** It is a lightweight editor with line
   numbers and real parser diagnostics. Syntax highlighting and IntelliSense
   are not provided.
6. **Breadboard tie-points are visual.** Power rails act as nets via wires;
   the 830 tie-point grid is not individually modelled.
7. **3D models are original primitives** (boxes/cylinders/discs with pin
   spheres), not photorealistic vendor models. Wires are tubes in 3D and
   quadratic curves in 2D; neither is a routed PCB trace.
8. **Backend defaults to SQLite** and in-process rate limiting — right for
   local/self-hosted use, not a multi-node deployment (see `infra/` notes).
9. **Mobile:** pages are responsive and the workspace is usable, but precise
   circuit editing is a desktop-first experience; the component library is
   hidden behind the canvas on narrow screens.
10. **Simulation timing** is virtual-time based on the browser's animation
    clock; heavy circuits can drift from wall-clock at high speeds.
