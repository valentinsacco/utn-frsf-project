// NodeMCU 1.0

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>

const char* ssid = "frsfpublica";
const char* password = "";

WebSocketsClient webSocket;

const char* serverUrl = "";  // Dirección IP del servidor dentro de la red
const int serverPort = 4200;

const char* nodeName = "planta-001";  //Nombre del nodo

bool connectedToServer = false;
bool P4BtnState = false;
bool P4LastBtnState = false;

unsigned long lastAnalogPinReadTime = 0;

const int motorPin1 = 12;
const int motorPin2 = 13;
const int motorPin3 = 14;
const int motorPin4 = 15;

int motorSpeed = 1200;
int stepCounter = 0;
int stepsPerRev = 4096;

const int numSteps = 8;
const int stepsLookup[8] = { B1000, B1100, B0100, B0110, B0010, B0011, B0001, B1001 };

bool motorWorking = false;
bool motorClockwise = true;

void setup() {
  Serial.begin(115200);

  pinMode(3, INPUT);
  pinMode(4, INPUT);
  pinMode(motorPin1, OUTPUT);
  pinMode(motorPin2, OUTPUT);
  pinMode(motorPin3, OUTPUT);
  pinMode(motorPin4, OUTPUT);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  webSocket.begin(serverUrl, serverPort);
  webSocket.setReconnectInterval(5000);
  webSocket.onEvent(webSocketEvent);
}


void loop() {
  unsigned long currentTime = millis();

  webSocket.loop();

  if (connectedToServer) {
    if (motorWorking) {
      if (motorClockwise) {
        clockwise();
        delayMicroseconds(motorSpeed);
      } else {
        anticlockwise();
        delayMicroseconds(motorSpeed);
      }
    }

    if ((currentTime - lastAnalogPinReadTime) >= 300) {
      int A0Value = analogRead(A0);
      String A0Data = "continuous-data:" + String(A0Value) + ":" + String(nodeName);
      Serial.println(A0Data);
      webSocket.sendTXT(A0Data); 
      lastAnalogPinReadTime = currentTime;
    }

    // Leyendo el estado del pin GPIO 4 o D2 (ESP8266)
    P4BtnState = digitalRead(4);

    // Pasando el estado (si hay un cambio de estado) al servidor vía WebSockets
    if (P4BtnState != P4LastBtnState) {
      if (P4BtnState == HIGH) {
        webSocket.sendTXT("state-change:HIGH");
      } else {
        webSocket.sendTXT("state-change:LOW");
      }
      P4LastBtnState = P4BtnState;
    }
  }
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("Disconnected from WebSocket server");
      connectedToServer = false;
      break;
    case WStype_CONNECTED:
      Serial.println("Connected to WebSocket server");
      connectedToServer = true;
      String initialMotorStatus = String("initial-status:motor:") + (motorWorking ? "true" : "false") + String("/") + String(nodeName);
      webSocket.sendTXT(initialMotorStatus);
      break;
    case WStype_TEXT:
      handleWebSocketConnection((char*)payload);
      break;
    case WStype_PING:
      webSocket.sendTXT("ping:pong");
  }
}

void handleWebSocketConnection(char* message) {
  String payloadString((char*)message);
  char* messageChar = const_cast<char*>(payloadString.c_str());

  char* event = strtok(messageChar, ":");
  char* value = strtok(NULL, ":");

  if (event != NULL) {
    if (strcmp(event, "ping") == 0) {
      webSocket.sendTXT("pong:client");
    }

    if (strcmp(event, "type") == 0) {
      webSocket.sendTXT("type:node");
    }

    if (strcmp(event, "node-name") == 0) {
      char response[50];
      sprintf(response, "%s:%s", "node-name", nodeName);
      webSocket.sendTXT(response);
    }

    if (strcmp(event, "direction") == 0) {
      if (strcmp(value, "clockwise") == 0) {
        Serial.println("[DigitalPin]: Motor girando en sentindo de las agujas del reloj");
        motorClockwise = true;
        motorWorking = true;
      } else if (strcmp(value, "anticlockwise") == 0) {
        Serial.println("[DigitalPin]: Motor girando en sentindo contrario a las agujas del reloj");
        motorClockwise = false;
        motorWorking = true;
      }
    }

    if (strcmp(event, "stop-motor") == 0) {
      Serial.println("[DigitalPin]: Motor parado");
      motorWorking = false;
    }

    String command = String(event);

    // Activando pines [ESP8266], mandando 'D12:HIGH', es decir, 'pin:estado'
    // Desde el pin 12 al 15
    if (command.startsWith("D")) {
      int pin = command.substring(1).toInt();
      char* state = value;

      if (strcmp(state, "HIGH") == 0) {
        digitalWrite(pin, HIGH);
      } else if (strcmp(state, "LOW") == 0) {
        digitalWrite(pin, LOW);
      }
    }
  }
}

void clockwise() {
  stepCounter++;
  if (stepCounter >= numSteps) stepCounter = 0;
  setOutput(stepCounter);
}

void anticlockwise() {
  stepCounter--;
  if (stepCounter < 0) stepCounter = numSteps - 1;
  setOutput(stepCounter);
}

void setOutput(int step) {
  digitalWrite(motorPin1, bitRead(stepsLookup[step], 0));
  digitalWrite(motorPin2, bitRead(stepsLookup[step], 1));
  digitalWrite(motorPin3, bitRead(stepsLookup[step], 2));
  digitalWrite(motorPin4, bitRead(stepsLookup[step], 3));
}
