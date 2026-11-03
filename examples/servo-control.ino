Servo sweep;
void setup() { sweep.attach(D9); }
void loop() {
  for (int a = 0; a <= 180; a += 10) { sweep.write(a); delay(120); }
  for (int a = 180; a >= 0; a -= 10) { sweep.write(a); delay(120); }
}
