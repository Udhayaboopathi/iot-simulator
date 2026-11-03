DHT dht(D2, DHT22);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.print("Temp: "); Serial.print(t); Serial.print(" C  Humidity: "); Serial.print(h); Serial.println(" %");
  delay(2000);
}
