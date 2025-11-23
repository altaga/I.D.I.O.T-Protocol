#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <M5Unified.h>

// WiFi credentials
const char* ssid = "";
const char* password = "";

// MQTT broker credentials
const char* mqtt_server = "";
const char* mqtt_user = "IDIOTuser";
const char* mqtt_password = "";
#define DEVICE_NAME "IMU Device"
#define SENSOR_TOPIC "sensors/IMUDevice2"

// Device identification
const char* eth_address = "0x9b5f692e1d1bcbcaa66949d3974cd5247c10ae3e";
const char* sensor_name = "IMU Device";
const char* description = "Hackathon Zone";

WiFiClient espClient;
PubSubClient client(espClient);

// Track max accelerometer values and latest gyro readings
float max_ax = 0, max_ay = 0, max_az = 0;
float last_gx = 0, last_gy = 0, last_gz = 0;

// Timing control
unsigned long lastSend = 0;
unsigned long lastSample = 0;
const unsigned long sampleInterval = 100; // ms (sample 10x per second)
const unsigned long sendInterval = 5000;  // ms (send every 5 s)

char* string2char(String command);

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (unsigned int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempt++;
    if (attempt > 40) ESP.restart();
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(DEVICE_NAME, mqtt_user, mqtt_password)) {
      Serial.println("connected");
      client.subscribe("esp32arm/input");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" Waiting 5 seconds before retry...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  M5.begin();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  max_ax = max_ay = max_az = 0;
  last_gx = last_gy = last_gz = 0;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost. Reconnecting...");
    setup_wifi();
  }
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  // Sample IMU every sampleInterval
  if (now - lastSample > sampleInterval) {
    lastSample = now;
    M5.update();
    if (M5.Imu.update()) {
      m5::imu_data_t data = M5.Imu.getImuData();
      // Store maximum absolute acceleration values
      max_ax = max(max_ax, abs(data.accel.x));
      max_ay = max(max_ay, abs(data.accel.y));
      max_az = max(max_az, abs(data.accel.z));
      // Store latest gyro readings
      last_gx = data.gyro.x;
      last_gy = data.gyro.y;
      last_gz = data.gyro.z;
    }
  }

  // Send MQTT message every sendInterval
  if (now - lastSend > sendInterval) {
    lastSend = now;

    StaticJsonDocument<256> doc;
    doc["address"] = eth_address;
    JsonObject dataObj = doc.createNestedObject("data");
    JsonObject accelObj = dataObj.createNestedObject("accel");
    accelObj["x"] = String(max_ax, 2);
    accelObj["y"] = String(max_ay, 2);
    accelObj["z"] = String(max_az, 2);
    JsonObject gyroObj = dataObj.createNestedObject("gyro");
    gyroObj["x"] = String(last_gx, 2);
    gyroObj["y"] = String(last_gy, 2);
    gyroObj["z"] = String(last_gz, 2);
    doc["name"] = sensor_name;
    doc["description"] = description;

    String output;
    serializeJson(doc, output);
    if (client.publish(SENSOR_TOPIC, string2char(output))) {
      Serial.println("MQTT publish OK:");
      Serial.println(output);
    } else {
      Serial.println("MQTT publish FAILED");
      Serial.println(output);
    }

    // Reset only accelerometer max for the next window
    max_ax = max_ay = max_az = 0;
    // gyro persists for latest value
  }
}

// Converts String to char* safely
char* string2char(String command) {
  if (command.length() != 0) {
    char* p = const_cast<char*>(command.c_str());
    return p;
  }
}
