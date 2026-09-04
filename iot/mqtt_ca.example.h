#pragma once

// Copy this file to ignored iot/mqtt_ca.h and replace the placeholder with the
// certificate authority that signs your broker's TLS certificate.
static const char MQTT_TLS_ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
broker CA certificate here
-----END CERTIFICATE-----
)EOF";
