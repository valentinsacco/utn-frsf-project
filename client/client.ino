#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <SocketIoClient.h>
#include <ArduinoJson.h>

SocketIoClient webSocket;

const char* wifi_ssid = "Nombre de la red WiFi";
const char* wifi_pass = "Contraseña de la red WiFi";

void setup() {
    Serial.begin(115200);
    delay(10);
    
    WiFi.begin(wifi_ssid, wifi_pass);
    
    while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.println("Conectando a la red WiFi...");
    }
  
    Serial.println("Conectado a la red WiFi");

    webSocket.begin("ip", 4200);
    webSocket.on("ping", wsReady);
    webSocket.on("data", event);
    webSocket.emit("data", "testing data sent from ESP");
}

void loop() {
    webSocket.loop();
}

void wsReady(const char * payload, size_t length) {
  Serial.print(payload);
}

void event(const char * payload, size_t length) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, payload);

  const char* data = doc["data"];
  Serial.print("data:");
  Serial.println(data);
}
