LiquidCrystal_I2C lcd(0x27, 16, 2);
int secs = 0;
void setup() { lcd.init(); lcd.backlight(); lcd.print("Hello, IoT Sim!"); }
void loop() { secs += 1; lcd.clear(); lcd.print("Uptime s: "); lcd.print(secs); delay(1000); }
