# Smart Shrimp Pond

IoT shrimp-pond monitoring and control prototype using **Firebase Realtime Database**, **Firebase Authentication**, a custom **HTML/JS web dashboard**, and **Wokwi** for IoT simulation.

```text
Web Dashboard ↔ Firebase Realtime Database ↔ IoT / Wokwi
                     ↑
             Firebase Authentication
```

## 1. Requirements

### Web
- Node.js 20+ and npm
- Firebase project with:
  - Authentication → Email/Password enabled
  - Realtime Database created
  - `database.rules.json` applied

### IoT
- Wokwi account or Wokwi VS Code extension
- ESP32/ESP8266 Wokwi project
- Arduino libraries used by the firmware, typically:
  - `ArduinoJson`
  - board-provided Wi-Fi / HTTP libraries

## 2. Firebase Setup

Create Firebase Authentication accounts for the dashboard user and IoT device, then create matching metadata records under:

```text
/users/{uid}
```

Example:

```json
{
  "role": "farmer",
  "pondId": "pond-001"
}
```

or:

```json
{
  "role": "device",
  "pondId": "pond-001"
}
```

Apply:

```text
firebase/database-example.json
firebase/database.rules.json
```

Main database paths:

```text
/ponds/{pondId}
/settings/{pondId}
/commands/{pondId}
/telemetry/{pondId}
/alerts/{pondId}
/events/{pondId}
```

## 3. Web Setup

From the web directory:

```bash
npm install
npm run dev
```

If Firebase is not already installed:

```bash
npm install firebase
```

Configure the Firebase Web SDK with your project values:

```js
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

The web should:

```text
Login
→ read current user profile
→ receive real-time sensor update
```

> If the web is plain HTML/JS using Firebase CDN imports, npm is not required; a local static server is enough.

## 4. IoT / Wokwi Setup

Configure the firmware with:

```text
Wi-Fi SSID/password
Firebase Web API key
Firebase Database URL
Device email/password
pondId
```

For Wokwi Wi-Fi:

```text
SSID: Wokwi-GUEST
Password: empty
```

Expected IoT flow:

```text
Connect Wi-Fi
→ login to Firebase
→ load /settings/{pondId}
→ read commands
→ read simulated sensors
→ apply automatic workflows
→ update /ponds/{pondId}
→ append /telemetry/{pondId}
→ create alerts/events when needed
```

## 5. Run Order

```text
1. Configure Firebase
2. Start web:
      npm install
      npm run dev
3. Start Wokwi simulation
4. Login to the dashboard
5. Verify live sensor values
6. Test a manual device command
7. Verify device state feedback
```

## 6. Secrets

Do not commit real credentials.

Recommended local files:

```text
web/.env
iot/secrets.h
```

Keep templates in Git:

```text
web/.env.example
iot/secrets.example.h
```

Add the real secret files to `.gitignore`.