void setup() { pinMode(D9, OUTPUT); pinMode(D10, OUTPUT); pinMode(D11, OUTPUT); }
void loop() {
  analogWrite(D9, 255); analogWrite(D10, 0); analogWrite(D11, 0); delay(800);
  analogWrite(D9, 0); analogWrite(D10, 255); analogWrite(D11, 0); delay(800);
  analogWrite(D9, 0); analogWrite(D10, 0); analogWrite(D11, 255); delay(800);
}
