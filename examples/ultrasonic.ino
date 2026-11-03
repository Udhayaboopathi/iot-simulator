void setup() { Serial.begin(9600); pinMode(D9, OUTPUT); pinMode(D10, INPUT); }
void loop() {
  digitalWrite(D9, LOW); delay(1);
  digitalWrite(D9, HIGH); delay(1);
  digitalWrite(D9, LOW);
  long us = pulseIn(D10, HIGH);
  long cm = us / 58;
  Serial.print("Distance: "); Serial.print(cm); Serial.println(" cm");
  delay(500);
}
