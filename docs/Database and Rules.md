# Smart Shrimp Pond — Firebase Database, Rules

## 1. Architecture


```text
                         Firebase Authentication
                              ↑           ↑
                              | login     | device login
                              |           |
Web Dashboard  ↔  Firebase Realtime Database  ↔  ESP8266 / Wokwi
    HTML/JS                                         |
                                                    ↓
                                             Sensors/Actuators
```

Main responsibilities:

| Component | Responsibility |
|---|---|
| Web | Login, display real-time data, change settings, send manual commands, display history/alerts |
| Firebase Authentication | Authenticate farmer and IoT/device accounts |
| Firebase Realtime Database | Shared real-time state, commands, telemetry, settings, alerts, events |
| ESP8266 / Wokwi | Read sensors, execute commands, run automatic workflows, publish state/history |

The ESP8266 is responsible for the time-critical automatic rules because there is no separate backend.

---

# 2. Authentication Model

Use **Firebase Authentication with Email/Password**.

Two account roles are used:

```text
farmer  → web dashboard user
device  → ESP8266 / Wokwi
```

Authentication credentials are stored by Firebase Authentication.

**Do not store passwords inside Realtime Database.**

Realtime Database only stores account metadata:

```text
/users/{uid}
```

Example:

```json
{
  "users": {
    "FARMER_FIREBASE_UID": {
      "role": "farmer",
      "pondId": "pond-001",
      "displayName": "Pond Operator"
    },

    "DEVICE_FIREBASE_UID": {
      "role": "device",
      "pondId": "pond-001",
      "displayName": "Pond Controller"
    }
  }
}
```

For the prototype, create these metadata records manually from the Firebase Console after creating the authentication accounts.

---

# 3. Login Endpoint

Because this architecture has no custom backend, login uses the Firebase Authentication REST API directly.

## Endpoint

```http
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}
Content-Type: application/json
```

## Farmer Login Request

```json
{
  "email": "farmer@example.com",
  "password": "example-password",
  "returnSecureToken": true
}
```

## Successful Response

Firebase returns a structure containing:

```json
{
  "localId": "FARMER_FIREBASE_UID",
  "email": "farmer@example.com",
  "idToken": "FIREBASE_ID_TOKEN",
  "refreshToken": "FIREBASE_REFRESH_TOKEN",
  "expiresIn": "3600"
}
```

The important value for Realtime Database authorization is:

```text
idToken
```

When using the Firebase JavaScript SDK, the SDK manages this token automatically.

When using Realtime Database through REST, the token can be supplied as:

```http
GET {DATABASE_URL}/ponds/pond-001.json?auth={ID_TOKEN}
```

---

# 4. Device Login

The ESP8266 / Wokwi controller can use a dedicated Firebase Authentication account.

Example:

```json
{
  "email": "pond001-device@example.com",
  "password": "device-password",
  "returnSecureToken": true
}
```

Use the same login endpoint:

```http
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}
```

After authentication, the IoT controller receives an `idToken` and uses it for Realtime Database requests.

The corresponding `/users/{uid}` record must contain:

```json
{
  "role": "device",
  "pondId": "pond-001"
}
```

---

# 5. Database Structure

Recommended Realtime Database tree:

```text
/
├─ users/
│  └─ {uid}
│
├─ ponds/
│  └─ {pondId}/
│     ├─ name
│     ├─ status
│     ├─ connected
│     ├─ lastSeenMs
│     ├─ sensors/
│     └─ devices/
│
├─ commands/
│  └─ {pondId}/
│     └─ {commandId}
│
├─ settings/
│  └─ {pondId}/
│
├─ telemetry/
│  └─ {pondId}/
│     └─ {timestampMs}
│
├─ alerts/
│  └─ {pondId}/
│     └─ {alertId}
│
└─ events/
   └─ {pondId}/
      └─ {eventId}
```

---

# 6. `/users`

Stores authorization metadata only.

## Path

```text
/users/{uid}
```

## Example

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

Allowed roles:

```text
farmer
device
```

The client should not be allowed to change its own `role` or `pondId`.

---

# 7. `/ponds/{pondId}`

Stores the latest known state of the pond.

## Example

```json
{
  "name": "Smart Shrimp Pond 001",
  "status": "normal",
  "connected": true,
  "lastSeenMs": 1786200000000,

  "sensors": {
    "ph": 7.8,
    "do": 5.6,
    "temperature": 30.2,
    "waterLevel": 68,
    "rain": false,
    "ec": 18.4,
    "salinity": 20.1
  },

  "devices": {
    "aerator": false,
    "drainagePump": false,
    "dilutionPump": false,
    "feeder": true,
    "buzzer": false,
    "warningBeacon": false
  }
}
```

### Write ownership

| Data | Writer |
|---|---|
| `name` | Farmer |
| `status` | Device |
| `connected` | Device |
| `lastSeenMs` | Device |
| `sensors` | Device |
| `devices` | Device |

---

# 8. `/settings/{pondId}`

Stores user-configurable system configuration.

## Example

```json
{
  "mode": "automatic",

  "thresholds": {
    "ph": {
      "normalMin": 7.5,
      "normalMax": 8.5,
      "warningLow": 7.5,
      "warningHigh": 8.8
    },

    "do": {
      "normalMin": 5.0,
      "hypoxia": 4.0,
      "critical": 3.5,
      "recovery": 5.5,
      "triggerDurationSec": 30
    },

    "temperature": {
      "normalMin": 28,
      "normalMax": 32,
      "warningLow": 25,
      "warningHigh": 33
    },

    "salinity": {
      "normalMin": 10,
      "normalMax": 25,
      "warningLow": 5,
      "warningHigh": 30
    },

    "waterLevel": {
      "normalMin": 40,
      "normalMax": 80,
      "warningLow": 30,
      "warningHigh": 90,
      "overflowTriggerDurationSec": 10
    }
  },

  "automation": {
    "hypoxiaResponseEnabled": true,
    "rainOverflowResponseEnabled": true,
    "heatSalinityResponseEnabled": true
  }
}
```

### Access

```text
Farmer → read + write
Device → read
```

The device listens for settings changes and updates its local thresholds.

---

# 9. `/commands/{pondId}`

Used by the web dashboard to request manual device actions.

## Example

```json
{
  "cmd-001": {
    "device": "aerator",
    "action": "on",
    "source": "manual",

    "createdAtMs": 1786200060000,

    "status": "pending",
    "processedAtMs": null
  }
}
```

Allowed devices:

```text
aerator
drainagePump
dilutionPump
feeder
buzzer
warningBeacon
```

Allowed actions:

```text
on
off
```

Command lifecycle:

```text
Web
 ↓
create command(status = pending)
 ↓
Firebase
 ↓
ESP8266 detects new command
 ↓
execute actuator
 ↓
update /ponds/{pondId}/devices
 ↓
set command status = completed
```

Suggested statuses:

```text
pending
completed
failed
```

---

# 10. `/telemetry/{pondId}`

Stores historical sensor measurements.

## Path

```text
/telemetry/{pondId}/{recordId}
```

The current device firmware uses rolling keys `slot-000` through `slot-099`.
Each upload overwrites one slot, so a pond retains at most the newest 100
firmware samples. The embedded `timestampMs` field remains the authoritative
time and is used by dashboard queries and sorting.

## Example

```json
{
  "1786200000000": {
    "timestampMs": 1786200000000,

    "ph": 7.8,
    "do": 5.6,
    "temperature": 30.2,
    "waterLevel": 68,
    "rain": false,
    "ec": 18.4,
    "salinity": 20.1
  },

  "1786200005000": {
    "timestampMs": 1786200005000,

    "ph": 7.8,
    "do": 5.5,
    "temperature": 30.3,
    "waterLevel": 68,
    "rain": false,
    "ec": 18.5,
    "salinity": 20.2
  }
}
```

The device writes telemetry at a fixed sampling interval.

Example:

```text
every 5 seconds
```

For a real deployment, telemetry should usually be stored less frequently than raw sensor sampling to control database usage.

---

# 11. `/alerts/{pondId}`

Stores active and historical environmental alerts.

## Hypoxia Example

```json
{
  "alert-001": {
    "type": "hypoxia",
    "severity": "critical",
    "status": "active",

    "message": "DO remained below 4.0 mg/L for 30 seconds.",

    "measurements": {
      "do": 3.7
    },

    "createdAtMs": 1786200100000,
    "resolvedAtMs": null
  }
}
```

## Rain / Overflow Example

```json
{
  "alert-002": {
    "type": "rain_overflow",
    "severity": "critical",
    "status": "active",

    "message": "Water level exceeded 90% during rainfall.",

    "measurements": {
      "rain": true,
      "waterLevel": 94,
      "ph": 7.2
    },

    "createdAtMs": 1786200200000,
    "resolvedAtMs": null
  }
}
```

## Heat + Salinity Example

```json
{
  "alert-003": {
    "type": "heat_salinity",
    "severity": "warning",
    "status": "active",

    "message": "Temperature and salinity exceeded configured limits.",

    "measurements": {
      "temperature": 34.1,
      "salinity": 31.4
    },

    "createdAtMs": 1786200300000,
    "resolvedAtMs": null
  }
}
```

Alerts are created and resolved by the IoT controller because automatic workflow logic is executed there.

---

# 12. `/events/{pondId}`

Stores important actions and system events.

## Automatic Actuator Event

```json
{
  "event-001": {
    "type": "device_action",
    "source": "automatic",

    "device": "aerator",
    "action": "on",
    "reason": "dissolved_oxygen_low",

    "createdAtMs": 1786200101000
  }
}
```

## Manual Actuator Event

```json
{
  "event-002": {
    "type": "device_action",
    "source": "manual",

    "device": "drainagePump",
    "action": "on",

    "createdAtMs": 1786200400000
  }
}
```

Other useful event types:

```text
device_action
mode_change
threshold_change
connection
workflow_started
workflow_resolved
```

---

# 13. Complete Example Database

```json
{
  "users": {
    "FARMER_FIREBASE_UID": {
      "role": "farmer",
      "pondId": "pond-001",
      "displayName": "Pond Operator"
    },

    "DEVICE_FIREBASE_UID": {
      "role": "device",
      "pondId": "pond-001",
      "displayName": "Pond Controller"
    }
  },

  "ponds": {
    "pond-001": {
      "name": "Smart Shrimp Pond 001",
      "status": "critical",
      "connected": true,
      "lastSeenMs": 1786200100000,

      "sensors": {
        "ph": 7.4,
        "do": 3.7,
        "temperature": 30.1,
        "waterLevel": 72,
        "rain": false,
        "ec": 19.1,
        "salinity": 20.8
      },

      "devices": {
        "aerator": true,
        "drainagePump": false,
        "dilutionPump": false,
        "feeder": false,
        "buzzer": true,
        "warningBeacon": true
      }
    }
  },

  "settings": {
    "pond-001": {
      "mode": "automatic",

      "thresholds": {
        "ph": {
          "normalMin": 7.5,
          "normalMax": 8.5,
          "warningLow": 7.5,
          "warningHigh": 8.8
        },

        "do": {
          "normalMin": 5.0,
          "hypoxia": 4.0,
          "critical": 3.5,
          "recovery": 5.5,
          "triggerDurationSec": 30
        },

        "temperature": {
          "normalMin": 28,
          "normalMax": 32,
          "warningLow": 25,
          "warningHigh": 33
        },

        "salinity": {
          "normalMin": 10,
          "normalMax": 25,
          "warningLow": 5,
          "warningHigh": 30
        },

        "waterLevel": {
          "normalMin": 40,
          "normalMax": 80,
          "warningLow": 30,
          "warningHigh": 90,
          "overflowTriggerDurationSec": 10
        }
      },

      "automation": {
        "hypoxiaResponseEnabled": true,
        "rainOverflowResponseEnabled": true,
        "heatSalinityResponseEnabled": true
      }
    }
  },

  "commands": {
    "pond-001": {
      "cmd-001": {
        "device": "aerator",
        "action": "on",
        "source": "manual",
        "createdAtMs": 1786200060000,
        "status": "completed",
        "processedAtMs": 1786200061000
      }
    }
  },

  "telemetry": {
    "pond-001": {
      "1786200100000": {
        "timestampMs": 1786200100000,
        "ph": 7.4,
        "do": 3.7,
        "temperature": 30.1,
        "waterLevel": 72,
        "rain": false,
        "ec": 19.1,
        "salinity": 20.8
      }
    }
  },

  "alerts": {
    "pond-001": {
      "alert-001": {
        "type": "hypoxia",
        "severity": "critical",
        "status": "active",
        "message": "DO remained below 4.0 mg/L for 30 seconds.",

        "measurements": {
          "do": 3.7
        },

        "createdAtMs": 1786200100000,
        "resolvedAtMs": null
      }
    }
  },

  "events": {
    "pond-001": {
      "event-001": {
        "type": "device_action",
        "source": "automatic",
        "device": "aerator",
        "action": "on",
        "reason": "dissolved_oxygen_low",
        "createdAtMs": 1786200101000
      }
    }
  }
}
```

---

# 8. `/simulation/{pondId}`

Controls sensor simulation scenarios and stores the simulation state reported by the device.

## Example

```json
{
  "control": {
    "enabled": true,
    "scenario": "rain_overflow",
    "requestId": "sim-001",
    "requestedAtMs": 1786200200000
  },

  "state": {
    "active": true,
    "scenario": "rain_overflow",
    "requestId": "sim-001",
    "startedAtMs": 1786200201000,
    "updatedAtMs": 1786200205000
  }
}
```

### Supported scenarios

`normal`, `rain_overflow`, `hypoxia`, `heat_salinity`.

### Write ownership

| Data      | Writer |
| --------- | ------ |
| `control` | Farmer |
| `state`   | Device |

The farmer requests a scenario through `control`. The device reads the request, simulates the corresponding sensor behavior, writes the resulting values to `/ponds/{pondId}/sensors`, and reports the active simulation through `state`.

Simulation values ramp from the current physical readings toward the scenario
target over multiple sensor uploads. This allows warning and critical thresholds
to be crossed progressively so actuator responses can be observed in Wokwi and
on the dashboard instead of all values changing in one update.

During a simulation, device outputs feed back into the simulated environment:
the aerator raises dissolved oxygen, the drainage pump lowers water level, the
dilution pump lowers temperature/conductivity/salinity, and feeding has a small
oxygen cost. Scenario pressure remains stronger than these corrections so the
full warning and critical workflow can still be demonstrated.

---


# 14. Realtime Database Security Rules

Recommended prototype `database.rules.json`:

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": false
      }
    },

    "ponds": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        "name": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'farmer' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 100"
        },

        "status": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.val() === 'normal' || newData.val() === 'warning' || newData.val() === 'critical'"
        },

        "connected": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.isBoolean()"
        },

        "lastSeenMs": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },

        "sensors": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.hasChildren(['ph', 'do', 'temperature', 'waterLevel', 'rain', 'ec', 'salinity'])",

          "ph": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 14"
          },

          "do": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 30"
          },

          "temperature": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 60"
          },

          "waterLevel": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100"
          },

          "rain": {
            ".validate": "newData.isBoolean()"
          },

          "ec": {
            ".validate": "newData.isNumber() && newData.val() >= 0"
          },

          "salinity": {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 60"
          },

          "$other": {
            ".validate": false
          }
        },

        "devices": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
          ".validate": "newData.hasChildren(['aerator', 'drainagePump', 'dilutionPump', 'feeder', 'buzzer', 'warningBeacon'])",

          "aerator": {
            ".validate": "newData.isBoolean()"
          },

          "drainagePump": {
            ".validate": "newData.isBoolean()"
          },

          "dilutionPump": {
            ".validate": "newData.isBoolean()"
          },

          "feeder": {
            ".validate": "newData.isBoolean()"
          },

          "buzzer": {
            ".validate": "newData.isBoolean()"
          },

          "warningBeacon": {
            ".validate": "newData.isBoolean()"
          },

          "$other": {
            ".validate": false
          }
        },

        "$other": {
          ".validate": false
        }
      }
    },

    "settings": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'farmer' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        "mode": {
          ".validate": "newData.val() === 'automatic' || newData.val() === 'manual'"
        }
      }
    },

    "commands": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        "$commandId": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'farmer' && root.child('users').child(auth.uid).child('pondId').val() === $pondId && !data.exists()",

          "device": {
            ".validate": "newData.val() === 'aerator' || newData.val() === 'drainagePump' || newData.val() === 'dilutionPump' || newData.val() === 'feeder' || newData.val() === 'buzzer' || newData.val() === 'warningBeacon'"
          },

          "action": {
            ".validate": "newData.val() === 'on' || newData.val() === 'off'"
          },

          "source": {
            ".validate": "newData.val() === 'manual'"
          },

          "createdAtMs": {
            ".validate": "newData.isNumber() && newData.val() >= 0"
          },

          "status": {
            ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
            ".validate": "newData.val() === 'pending' || newData.val() === 'completed' || newData.val() === 'failed'"
          },

          "processedAtMs": {
            ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
            ".validate": "newData.val() === null || (newData.isNumber() && newData.val() >= 0)"
          }
        }
      }
    },

    "telemetry": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",
        ".indexOn": ["timestampMs"],

        "$timestampMs": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

          ".validate": "newData.hasChildren(['timestampMs', 'ph', 'do', 'temperature', 'waterLevel', 'rain', 'ec', 'salinity'])"
        }
      }
    },

    "alerts": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        "$alertId": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'device' && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

          "status": {
            ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'farmer' && root.child('users').child(auth.uid).child('pondId').val() === $pondId && data.val() === 'active' && newData.val() === 'resolved'",
            ".validate": "newData.val() === 'active' || newData.val() === 'resolved'"
          },

          "resolvedAtMs": {
            ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'farmer' && root.child('users').child(auth.uid).child('pondId').val() === $pondId && newData.isNumber() && newData.val() >= 0",
            ".validate": "newData.val() === null || (newData.isNumber() && newData.val() >= 0)"
          }
        }
      }
    },

    "events": {
      "$pondId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId",

        "$eventId": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('pondId').val() === $pondId"
        }
      }
    }
  }
}
```

---

# 15. Important Rule Behavior

### Farmer account

Allowed:

```text
READ   pond state
READ   telemetry
READ   alerts
READ   events
READ   settings

WRITE  settings
WRITE  new manual commands
WRITE  pond name
WRITE  events
WRITE  simulation control
```

Not allowed:

```text
WRITE sensor values
WRITE actual actuator state
WRITE pond status
WRITE alerts
WRITE device connection state
```

### Device account

Allowed:

```text
READ   settings
READ   commands
READ   pond data

WRITE  sensor state
WRITE  device state
WRITE  pond status
WRITE  connection status
WRITE  telemetry
WRITE  alerts
WRITE  events
WRITE  command completion status
WRITE  simulation state
```

Not allowed:

```text
CHANGE system settings
CREATE manual commands
CHANGE its role
CHANGE its pondId
```

---

# 16. Web Login Flow

```text
User enters email/password
        ↓
Firebase Authentication login endpoint
        ↓
Firebase returns uid + ID token
        ↓
Read /users/{uid}
        ↓
Check role == farmer
        ↓
Read user's pondId
        ↓
Subscribe to:
    /ponds/{pondId}
    /alerts/{pondId}
    /settings/{pondId}
        ↓
Dashboard becomes active
```

With the Firebase JavaScript SDK this can be implemented with:

```js
signInWithEmailAndPassword(auth, email, password)
```

The SDK then attaches the Firebase authentication state automatically to Realtime Database operations.

---

# 17. IoT Startup Flow

```text
ESP8266 starts
      ↓
Connect Wi-Fi
      ↓
Login using dedicated device Firebase account
      ↓
Receive Firebase ID token
      ↓
Read /users/{uid}
      ↓
Get pondId
      ↓
Read /settings/{pondId}
      ↓
Listen to /commands/{pondId}
      ↓
Start sensor loop
```

Main runtime loop:

```text
Read sensors
      ↓
Apply configured automatic rules
      ↓
Operate actuators if required
      ↓
Update /ponds/{pondId}
      ↓
Append /telemetry/{pondId}
      ↓
Create alert/event if required
```

---

# 18. Automatic Workflow Ownership

Without Node-RED or a backend, the ESP8266 / Wokwi firmware owns automatic response logic.

## Hypoxia

```text
DO < 4.0 mg/L for >= 30 s
    ↓
status = critical
aerator = ON
feeder = OFF
buzzer = ON
warningBeacon = ON
create hypoxia alert
```

Recovery:

```text
DO > 5.5 mg/L
```

## Rain / Overflow

```text
waterLevel > 90% for >= 10 s
        +
rain == true
    ↓
drainagePump = ON
aerator = ON
create rain_overflow alert
```

pH is also monitored for rainfall-associated acidification.

## Heat + Salinity

```text
temperature > 33°C
        AND
salinity > 30 ppt
    ↓
dilutionPump = ON
feeder = OFF
create heat_salinity alert
```

---

# 19. Recommended Project Files

```text
smart-shrimp-pond/
├─ web/
│  ├─ index.html
│  ├─ style.css
│  └─ app.js
│
├─ iot/
│  ├─ diagram.json
│  ├─ wokwi.toml
│  └─ main.cpp
│
└─ firebase/
   ├─ database-example.json
   └─ database.rules.json
```

The JSON under Sections 13 and 14 can be used as the starting content for:

```text
firebase/database-example.json
firebase/database.rules.json
```

---
