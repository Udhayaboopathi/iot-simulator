# E2E (CDP)

Start a Chromium with `--remote-debugging-port=9224` and the web preview on :5173, then run `node scripts/e2e-cdp.mjs`. It opens the LED-blink workspace, clicks Run and asserts Serial shows LED ON/OFF.
