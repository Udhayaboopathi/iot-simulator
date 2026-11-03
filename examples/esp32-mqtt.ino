DHT dht(GPIO15, DHT22);
void setup() { Serial.begin(115200); dht.begin(); mqtt.connect(); }
void loop() {
  float t = dht.readTemperature();
  Serial.print("Publishing temp: "); Serial.println(t);
  mqtt.publish("iot/room1/temperature", t);
  delay(2000);
}
