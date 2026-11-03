void setup() { pinMode(D13, OUTPUT); pinMode(D2, INPUT); }
void loop() {
  int state = digitalRead(D2);
  digitalWrite(D13, state);
}
