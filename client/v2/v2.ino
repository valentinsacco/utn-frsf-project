// NodeMCU 1.0

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// --- Datos de la Red WiFi ---

#define SSID "frsfpublica"
#define PASSWORD ""

// --- Datos del Servidor ---

#define SERVER_URL ""
#define SERVER_PORT 4200

// --- Datos del Nodo ---

#define NODE_NAME "planta-002"

// --- Datos del Motor ---

#define MOTOR_PIN_1 12
#define MOTOR_PIN_2 13
#define MOTOR_PIN_3 14
#define MOTOR_PIN_4 15
#define MOTOR_SPEED 1200
#define STEPS_PER_REV 4096
#define NUM_STEPS 8
#define STEPS_LOOKUP {B1000, B1100, B0100, B0110, B0010, B0011, B0001, B1001}

// --- Cliente WebSockets ---

WebSocketsClient webSocket;

// --- Variables ---

bool connectedToServer = false;
bool motorWorking = false;
bool motorDirection = true; // true: avanza, false: retrocede

unsigned long lastAnalogPinReadTime = 0;

int stepCounter = 0;
const int numSteps = NUM_STEPS;
const int stepsLookup[NUM_STEPS] = STEPS_LOOKUP;

void setup() {
    Serial.begin(115200);

    pinMode(MOTOR_PIN_1, OUTPUT);
    pinMode(MOTOR_PIN_2, OUTPUT);
    pinMode(MOTOR_PIN_3, OUTPUT);
    pinMode(MOTOR_PIN_4, OUTPUT);

    WiFi.begin(SSID, PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }

    Serial.println("Connected to WiFi");

    webSocket.begin(SERVER_URL, SERVER_PORT);
    webSocket.setReconnectInterval(5000);
    webSocket.onEvent(webSocketEvent);
}

void loop() {
    unsigned long currentTime = millis();

    webSocket.loop();

    if (connectedToServer) {
        if (motorWorking) {
            if (motorDirection) {
                clockwise();
                delayMicroseconds(MOTOR_SPEED);
            }
            else {
                anticlockwise();
                delayMicroseconds(MOTOR_SPEED);
            }
        }

        if ((currentTime - lastAnalogPinReadTime) >= 500) {
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

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("Disconnected from WebSocket server");
            connectedToServer = false;
            break;
        case WStype_CONNECTED: {
            Serial.println("Connected to WebSocket server");
            connectedToServer = true;

            StaticJsonDocument<200> doc;

            doc["event"] = "initialStateNode";
            doc["nodeName"] = NODE_NAME;
            
            JsonObject data = doc.createNestedObject("data");
            data["motorStatus"] = parseBooleanToString(motorWorking);
            data["motorDirection"] = motorDirection ? "clockwise" : "anticlockwise";

            char object[200];
            serializeJson(doc, object);

            webSocket.sendTXT(object);
            break;
        }
        case WStype_TEXT:
            handleWebSocketConnection((char *)payload);
            break;
        case WStype_PING:
            webSocket.sendTXT("ping:pong");
    }
}

void handleWebSocketConnection(char *message) {
    String payloadString((char *)message);
    char *json = const_cast<char *>(payloadString.c_str());
    
    if (json == nullptr) {
        Serial.println(F("Error: PayloadString.c_str() devolvió un puntero nulo."));
        return;
    }

    StaticJsonDocument<512> doc;

    DeserializationError error = deserializeJson(doc, json);

    if (error) {
        Serial.print(F("deserializeJson() failed: "));
        Serial.println(error.f_str());
        return;
    }

    String event = doc["event"];
    String destination = doc["destination"];
    String value = doc["data"];
    String nodeName = doc["nodeName"];

    if (event != NULL && destination.c_str() != "client"  && value != NULL) {
    //     if (strcmp(event, "ping") == 0)
    //     {
    //         webSocket.sendTXT("pong:client");
    //     }

        if (strcmp(event.c_str(), "type") == 0) {
            StaticJsonDocument<200> doc;

            doc["event"] = "type";
            doc["nodeName"] = NODE_NAME;
            doc["data"] = "node";

            char object[200];
            serializeJson(doc, object);

            webSocket.sendTXT(object);
        }

        if (strcmp(nodeName.c_str(), NODE_NAME) == 0) {
            if (strcmp(event.c_str(), "startMotorNode") == 0) {
                if (value == "clockwise") {
                    Serial.println("[DigitalPin]: Motor girando en sentindo de las agujas del reloj");
                    motorDirection = true;
                    motorWorking = true;
                    clockwise();
                }
                else if (value == "anticlockwise") {
                    Serial.println("[DigitalPin]: Motor girando en sentindo contrario a las agujas del reloj");
                    motorDirection = false;
                    motorWorking = true;
                    anticlockwise();
                }
            }

            if (strcmp(event.c_str(), "stopMotorNode") == 0) {
                Serial.println("[DigitalPin]: Motor parado");
                motorWorking = false;
            }

            if (strcmp(event.c_str(), "currentStateNode") == 0) {
                Serial.println("[DigitalPin]: Estado actual del nodo");
                StaticJsonDocument<200> doc;

                doc["event"] = "currentStateNode";
                doc["nodeName"] = NODE_NAME;
                
                JsonObject data = doc.createNestedObject("data");
                data["motorStatus"] = parseBooleanToString(motorWorking);
                data["motorDirection"] = motorDirection ? "clockwise" : "anticlockwise";

                char object[200];
                serializeJson(doc, object);

                Serial.println(object);

                webSocket.sendTXT(object);
            }
        }

    //     if (strcmp(event, "direction") == 0)
    //     {
    //         if (strcmp(value, "clockwise") == 0)
    //         {
    //             Serial.println("[DigitalPin]: Motor girando en sentindo de las agujas del reloj");
    //             motorDirection = true;
    //             motorWorking = true;
    //         }
    //         else if (strcmp(value, "anticlockwise") == 0)
    //         {
    //             Serial.println("[DigitalPin]: Motor girando en sentindo contrario a las agujas del reloj");
    //             motorDirection = false;
    //             motorWorking = true;
    //         }
    //     }

    //     if (strcmp(event, "stop-motor") == 0)
    //     {
    //         Serial.println("[DigitalPin]: Motor parado");
    //         motorWorking = false;
    //     }

    //     String command = String(event);

    //     // Activando pines [ESP8266], mandando 'D12:HIGH', es decir, 'pin:estado'
    //     // Desde el pin 12 al 15
    //     if (command.startsWith("D"))
    //     {
    //         int pin = command.substring(1).toInt();
    //         char *state = value;

    //         if (strcmp(state, "HIGH") == 0)
    //         {
    //             digitalWrite(pin, HIGH);
    //         }
    //         else if (strcmp(state, "LOW") == 0)
    //         {
    //             digitalWrite(pin, LOW);
    //         }
    //     }
    }
}

String parseBooleanToString(bool variable) {
    if (variable) {
        return "true";
    }
    else {
        return "false";
    }
}

void clockwise() {
    stepCounter++;
    if (stepCounter >= numSteps)
        stepCounter = 0;
    setOutput(stepCounter);
}

void anticlockwise() {
    stepCounter--;
    if (stepCounter < 0)
        stepCounter = numSteps - 1;
    setOutput(stepCounter);
}

void setOutput(int step) {
    digitalWrite(MOTOR_PIN_1, bitRead(stepsLookup[step], 0));
    digitalWrite(MOTOR_PIN_2, bitRead(stepsLookup[step], 1));
    digitalWrite(MOTOR_PIN_3, bitRead(stepsLookup[step], 2));
    digitalWrite(MOTOR_PIN_4, bitRead(stepsLookup[step], 3));
}


