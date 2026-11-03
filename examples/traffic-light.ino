void setup() { pinMode(D8, OUTPUT); pinMode(D9, OUTPUT); pinMode(D10, OUTPUT); }
void loop() {
  digitalWrite(D8, HIGH); digitalWrite(D9, LOW); digitalWrite(D10, LOW); delay(2000);
  digitalWrite(D9, HIGH); delay(600);
  digitalWrite(D8, LOW); digitalWrite(D9, LOW); digitalWrite(D10, HIGH); delay(2000);
  digitalWrite(D10, LOW); digitalWrite(D9, HIGH); delay(600);
}
