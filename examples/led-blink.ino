// Arduino LED blink — D13 drives an LED through a 220 ohm resistor.
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
