// NodeMCU 1.0

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// * NO BORRAR NINGUNA DE ESTÁS VARIABLES, DEBEN SER ENVIADAS AL SERVIDOR *

#define D0 16
#define D1 5
#define D2 4
#define D3 0
#define D4 2
#define D5 14
#define D6 12
#define D7 13
#define D8 15

// * NO BORRAR NINGUNA DE ESTÁS VARIABLES, DEBEN SER ENVIADAS AL SERVIDOR *

#define D_MODE INPUT
#define D1_MODE INPUT
#define D2_MODE INPUT
#define D3_MODE INPUT
#define D4_MODE INPUT
#define D5_MODE INPUT
#define D6_MODE INPUT
#define D7_MODE INPUT
#define D8_MODE OUTPUT

#define STRINGIZE(x) #x

// --- Variables ---

const char *ssid = "frsfpublica";
const char *password = "";

WebSocketsClient webSocket;

const char* serverUrl = "10.15.150.2";
const int serverPort = 4200;

const char* nodeName = "planta-001";

bool connectedToServer = false;

void setup()
{
    Serial.begin(115200);

    pinMode(D0, D_MODE);
    pinMode(D1, D1_MODE);
    pinMode(D2, D2_MODE);
    pinMode(D3, D3_MODE);
    pinMode(D4, D4_MODE);
    pinMode(D5, D5_MODE);
    pinMode(D6, D6_MODE);
    pinMode(D7, D7_MODE);
    pinMode(D8, D8_MODE);

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");

    webSocket.begin(serverUrl, serverPort);
    webSocket.setReconnectInterval(5000);
    webSocket.onEvent(webSocketEvent);
}

void loop()
{
    webSocket.loop();
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_DISCONNECTED:
        Serial.println("Disconnected from WebSocket server");
        connectedToServer = false;
        break;
    case WStype_CONNECTED:
    {
        Serial.println("Connected to WebSocket server");
        connectedToServer = true;
        break;
    }
    case WStype_TEXT:
        handleWebSocketConnection((char *)payload);
        break;
    case WStype_PING:
        webSocket.sendTXT("ping:pong");
    }
}

void handleWebSocketConnection(char *message)
{
    String payloadString((char *)message);
    char *messageChar = const_cast<char *>(payloadString.c_str());

    char *event = strtok(messageChar, ":");
    char *value = strtok(NULL, ":");

    if (event != NULL)
    {
        if (strcmp(event, "ping") == 0)
        {
            webSocket.sendTXT("pong:client");
        }

        if (strcmp(event, "type") == 0)
        {
            webSocket.sendTXT("type:node");
        }

        if (strcmp(event, "node-name") == 0)
        {
            char response[50];
            sprintf(response, "%s:%s", "node-name", nodeName);
            webSocket.sendTXT(response);

            // Build JSON where key is pin number and value is pin mode

            StaticJsonDocument<200> doc;

            doc["D0"] = parseMacro(D_MODE);
            doc["D1"] = parseMacro(D1_MODE);
            doc["D2"] = parseMacro(D2_MODE);
            doc["D3"] = parseMacro(D3_MODE);
            doc["D4"] = parseMacro(D4_MODE);
            doc["D5"] = parseMacro(D5_MODE);
            doc["D6"] = parseMacro(D6_MODE);
            doc["D7"] = parseMacro(D7_MODE);
            doc["D8"] = parseMacro(D8_MODE);

            char object[200];
            serializeJson(doc, object);

            char responsePins[300];
            sprintf(response, "%s:%s", "pins-config", object);

            webSocket.sendTXT(responsePins);
        }

        // if (strcmp(event, "pins-config")) {
        //     // Build JSON where key is pin number and value is pin mode
// 
        //     StaticJsonDocument<200> doc;
// 
        //     doc["D0"] = parseMacro(D_MODE);
        //     doc["D1"] = parseMacro(D1_MODE);
        //     doc["D2"] = parseMacro(D2_MODE);
        //     doc["D3"] = parseMacro(D3_MODE);
        //     doc["D4"] = parseMacro(D4_MODE);
        //     doc["D5"] = parseMacro(D5_MODE);
        //     doc["D6"] = parseMacro(D6_MODE);
        //     doc["D7"] = parseMacro(D7_MODE);
        //     doc["D8"] = parseMacro(D8_MODE);
// 
        //     char object[200];
        //     serializeJson(doc, object);
// 
        //     char response[300];
        //     sprintf(response, "%s:%s", "pins-config", object);
// 
        //     webSocket.sendTXT(response);
        // }

        String command = String(event);
    }
}

String parseMacro (int macro) {
  if (macro == 0) {
    return "INPUT";
  } else if (macro == 1) {
    return "OUTPUT";
  } else {
    return "UNDEFINED";
  }
}
