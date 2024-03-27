// NodeMCU 1.0

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// --- Modo Depuración ---

// #define DEBUG_MODE false

// --- Datos de la Red WiFi ---

#define SSID ""
#define PASSWORD ""

// --- Datos del Servidor ---

#define SERVER_URL ""
#define SERVER_PORT 4200

// --- Datos del Nodo ---

#define NODE_NAME ""

// --- Datos del Motor ---

#define MOTOR_PIN_1 12
#define MOTOR_PIN_2 13
#define MOTOR_PIN_3 14
#define MOTOR_PIN_4 15
#define MOTOR_SPEED 1200
#define STEPS_PER_REV 4096
#define NUM_STEPS 8
#define STEPS_LOOKUP                                       \
  {                                                        \
    B1000, B1100, B0100, B0110, B0010, B0011, B0001, B1001 \
  }

// --- Datos de los LEDs ---

#define MOTOR_STATUS_LED 4
#define CLOCKWISE_DIRECTION_LED 5
#define ANTICLOCKWISE_DIRECTION_LED 16

// --- Datos de Control Local ---

#define START_MOTOR_BTN 0
#define STOP_MOTOR_BTN 2

// --- Cliente WebSockets ---

WebSocketsClient webSocket;

// --- Variables ---

bool connectedToServer = false;
bool motorWorking = false;
bool motorDirection = true; // true: avanza, false: retrocede
bool startMotorBtnStatus = false;
bool stopMotorBtnStatus = false;

unsigned long lastAnalogPinReadTime = 0;
unsigned long lastMotorActionTime = 0;
// unsigned long lastDebugModeTime = 0;
unsigned long lastLocalControlTime = 0;

unsigned long motorActionInterval = MOTOR_SPEED;
// unsigned long debugModeInterval = 500 * 1000;
unsigned long localControlInterval = 50 * 1000;
unsigned long sendAnalogDataInterval = 500 * 1000;

int stepCounter = 0;
const int numSteps = NUM_STEPS;
const int stepsLookup[NUM_STEPS] = STEPS_LOOKUP;

bool localMotorControl = true;

void setup()
{
  Serial.begin(115200);

  // --- Configurando Salidas ---

  // Motor
  pinMode(MOTOR_PIN_1, OUTPUT);
  pinMode(MOTOR_PIN_2, OUTPUT);
  pinMode(MOTOR_PIN_3, OUTPUT);
  pinMode(MOTOR_PIN_4, OUTPUT);

  // LEDs
  pinMode(MOTOR_STATUS_LED, OUTPUT);
  pinMode(CLOCKWISE_DIRECTION_LED, OUTPUT);
  pinMode(ANTICLOCKWISE_DIRECTION_LED, OUTPUT);

  // --- Configurando Entradas ---

  // Control del Motor
  pinMode(START_MOTOR_BTN, INPUT_PULLUP);
  pinMode(STOP_MOTOR_BTN, INPUT_PULLUP);

  // --- Conexión a la Red WiFi ---

  WiFi.begin(SSID, PASSWORD);

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }

  Serial.println("Connected to WiFi");

  // --- Conexión al Servidor ---

  webSocket.begin(SERVER_URL, SERVER_PORT);
  webSocket.setReconnectInterval(5000);
  webSocket.onEvent(webSocketEvent);
}

void loop()
{
  unsigned long currentTime = micros();

  webSocket.loop();

  // Estas condiciones permiten convertir código sincróno en asíncrono para evitar bloqueos (delay)
  if ((currentTime - lastLocalControlTime) >= localControlInterval)
  {
    handleLocalControl();
  }

  // Estas condiciones permiten convertir código sincróno en asíncrono para evitar bloqueos (delay)
  if ((currentTime - lastMotorActionTime) >= motorActionInterval)
  {
    handleMotor();
    lastMotorActionTime = currentTime;
  }

  // Estas condiciones permiten convertir código sincróno en asíncrono para evitar bloqueos (delay)
  // if ((currentTime - lastDebugModeTime) >= debugModeInterval && (DEBUG_MODE))
  // {
  //   motorDebugMode();
  // }

  if (connectedToServer)
  {
    if ((currentTime - lastAnalogPinReadTime) >= sendAnalogDataInterval)
    {
      int A0Value = analogRead(A0);

      StaticJsonDocument<200> doc;

      doc["event"] = "continuousData";
      doc["nodeName"] = NODE_NAME;
      JsonObject data = doc.createNestedObject("data");

      data["value"] = String(A0Value);
      data["time"] = String(currentTime);

      char object[200];
      serializeJson(doc, object);

      webSocket.sendTXT(object);
      lastAnalogPinReadTime = currentTime;
    }
  }
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_DISCONNECTED:
    Serial.println("Desconectado del servidor WebSocket");
    connectedToServer = false;
    break;
  case WStype_CONNECTED:
  {
    Serial.println("Conectado al servidor WebSocket");
    connectedToServer = true;

    StaticJsonDocument<200> doc;

    doc["event"] = "initialStateNode";
    doc["nodeName"] = NODE_NAME;

    JsonObject data = doc.createNestedObject("data");
    data["motorStatus"] = parseBooleanToString(motorWorking);
    data["motorDirection"] = motorDirection ? "clockwise" : "anticlockwise";
    data["control"] = localMotorControl ? "local" : "remote";

    char object[200];
    serializeJson(doc, object);

    webSocket.sendTXT(object);
    break;
  }
  case WStype_TEXT:
    handleWebSocketConnection((char *)payload);
    break;
  // case WStype_PING:
  //   webSocket.sendTXT("ping:pong");
  // }
}

void handleWebSocketConnection(char *message)
{
  String payloadString((char *)message);
  char *json = const_cast<char *>(payloadString.c_str());

  if (json == nullptr)
  {
    Serial.println(F("Error: PayloadString.c_str() devolvió un puntero nulo."));
    return;
  }

  StaticJsonDocument<512> doc;

  DeserializationError error = deserializeJson(doc, json);

  if (error)
  {
    Serial.print(F("deserializeJson() falló: "));
    Serial.println(error.f_str());
    return;
  }

  String event = doc["event"];
  String destination = doc["destination"];
  String value = doc["data"];
  String nodeName = doc["nodeName"];

  // if (DEBUG_MODE)
  // {
  //   Serial.print("[DEBUG] Nombre del Evento: ");
  //   Serial.println(event);
  //   Serial.print("[DEBUG] Destino: ");
  //   Serial.println(destination);
  //   Serial.print("[DEBUG] Valor del Evento: ");
  //   Serial.println(value);
  //   Serial.print("[DEBUG] Nombre del Nodo: ");
  //   Serial.println(nodeName);
  //   Serial.println(" ");
  // }

  if (event != NULL && destination.c_str() != "client" && value != NULL)
  {
    if (strcmp(event.c_str(), "ping") == 0)
    {
      StaticJsonDocument<200> doc;

      doc["event"] = "pong";
      doc["nodeName"] = NODE_NAME;
      doc["data"] = value;

      char object[200];
      serializeJson(doc, object);

      webSocket.sendTXT(object);
    }

    if (strcmp(event.c_str(), "type") == 0)
    {
      StaticJsonDocument<200> doc;

      doc["event"] = "type";
      doc["nodeName"] = NODE_NAME;
      doc["data"] = "node";

      char object[200];
      serializeJson(doc, object);

      webSocket.sendTXT(object);
    }

    if (strcmp(nodeName.c_str(), NODE_NAME) == 0)
    {
      if (strcmp(event.c_str(), "startMotorNode") == 0)
      {
        if (!localMotorControl)
        {
          if (value == "clockwise")
          {
            Serial.println("[DigitalPin]: Motor girando en sentindo de las agujas del reloj");
            motorDirection = true;
            motorWorking = true;
            digitalWrite(MOTOR_STATUS_LED, HIGH);
            digitalWrite(CLOCKWISE_DIRECTION_LED, HIGH);
            digitalWrite(ANTICLOCKWISE_DIRECTION_LED, LOW);
            clockwise();
          }
          else if (value == "anticlockwise")
          {
            Serial.println("[DigitalPin]: Motor girando en sentindo contrario a las agujas del reloj");
            motorDirection = false;
            motorWorking = true;
            digitalWrite(MOTOR_STATUS_LED, HIGH);
            digitalWrite(ANTICLOCKWISE_DIRECTION_LED, HIGH);
            digitalWrite(CLOCKWISE_DIRECTION_LED, LOW);
            anticlockwise();
          }
        }
      }

      if (strcmp(event.c_str(), "stopMotorNode") == 0)
      {
        if (!localMotorControl)
        {
          Serial.println("[DigitalPin]: Motor parado");
          digitalWrite(MOTOR_STATUS_LED, LOW);
          digitalWrite(ANTICLOCKWISE_DIRECTION_LED, LOW);
          digitalWrite(CLOCKWISE_DIRECTION_LED, LOW);
          motorWorking = false;
        }
      }

      if (strcmp(event.c_str(), "currentStateNode") == 0)
      {
        Serial.println("[DigitalPin]: Enviando estado actual del nodo");
        StaticJsonDocument<200> doc;

        doc["event"] = "currentStateNode";
        doc["nodeName"] = NODE_NAME;

        JsonObject data = doc.createNestedObject("data");
        data["motorStatus"] = parseBooleanToString(motorWorking);
        data["motorDirection"] = motorDirection ? "clockwise" : "anticlockwise";
        data["control"] = localMotorControl ? "local" : "remote";

        char object[200];
        serializeJson(doc, object);

        webSocket.sendTXT(object);
      }

      if (strcmp(event.c_str(), "motorControl") == 0)
      {
        Serial.print("[DigitalPin]: Control del motor: ");
        Serial.println(value);
        if (value == "local")
        {
          localMotorControl = true;
        }
        else if (value == "remote")
        {
          localMotorControl = false;
        }
      }
    }
  }
}

void handleMotor()
{
  if (motorWorking)
  {
    digitalWrite(MOTOR_STATUS_LED, HIGH);
    if (motorDirection)
    {
      clockwise();
    }
    else
    {
      anticlockwise();
    }

    if (motorDirection)
    {
      digitalWrite(CLOCKWISE_DIRECTION_LED, HIGH);
      digitalWrite(ANTICLOCKWISE_DIRECTION_LED, LOW);
    }
    else
    {
      digitalWrite(ANTICLOCKWISE_DIRECTION_LED, HIGH);
      digitalWrite(CLOCKWISE_DIRECTION_LED, LOW);
    }
  }
  else
  {
    digitalWrite(MOTOR_STATUS_LED, LOW);
  }
}

void handleLocalControl()
{
  if (localMotorControl)
  {
    bool startMotorBtn = digitalRead(START_MOTOR_BTN);
    bool stopMotorBtn = digitalRead(STOP_MOTOR_BTN);

    // LOW = Botón presionado
    if (startMotorBtn == LOW && stopMotorBtn == HIGH && !motorWorking)
    {
      motorWorking = true;
    }
    else if (stopMotorBtn == LOW && startMotorBtn == HIGH && motorWorking)
    {
      motorWorking = false;
    }
  }
}

// void motorDebugMode()
// {
//   Serial.print("Estado del Motor: ");
//   Serial.println(motorWorking ? "Girando" : "Apagado");

//   Serial.print("Dirección del Motor: ");
//   Serial.println(motorDirection ? "Avance" : "Retroceso");
// }

// char *parseJSONToString(JsonObject object)
// {
//   char buffer[200];
//   serializeJson(object, buffer);
//   return buffer;
// }

String parseBooleanToString(bool variable)
{
  if (variable)
  {
    return "true";
  }
  else
  {
    return "false";
  }
}

void clockwise()
{
  stepCounter++;
  if (stepCounter >= numSteps)
    stepCounter = 0;
  setOutput(stepCounter);
}

void anticlockwise()
{
  stepCounter--;
  if (stepCounter < 0)
    stepCounter = numSteps - 1;
  setOutput(stepCounter);
}

void setOutput(int step)
{
  digitalWrite(MOTOR_PIN_1, bitRead(stepsLookup[step], 0));
  digitalWrite(MOTOR_PIN_2, bitRead(stepsLookup[step], 1));
  digitalWrite(MOTOR_PIN_3, bitRead(stepsLookup[step], 2));
  digitalWrite(MOTOR_PIN_4, bitRead(stepsLookup[step], 3));
}
