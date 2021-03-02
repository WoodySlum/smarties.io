#include <Smarties.h>
#include <string>
#include <memory>

String JSON_CONFIG = "%config%";
Smarties smarties = Smarties();

void openGate() {
	digitalWrite(D1, LOW);
	delay(50);
 	digitalWrite(D1, HIGH);
	smarties.getWebServer().send(200, "application/json", "{\"success\":true}");
}

void stopGate() {
	digitalWrite(D1, LOW);
	delay(50);
 	digitalWrite(D1, HIGH);
	delay(100);
	digitalWrite(D1, LOW);
	delay(50);
 	digitalWrite(D1, HIGH);
	smarties.getWebServer().send(200, "application/json", "{\"success\":true}");
}

void openGatePedestrian() {
	digitalWrite(D3, LOW);
	delay(50);
 	digitalWrite(D3, HIGH);
	smarties.getWebServer().send(200, "application/json", "{\"success\":true}");
}

void ping() {
    smarties.ping();
    smarties.getWebServer().send(200, "application/json", "{\"success\":true}");
}


void setup() {
    smarties.setup(JSON_CONFIG);

	pinMode(D1, OUTPUT);
  	digitalWrite(D1, HIGH);
	pinMode(D3, OUTPUT);
  	digitalWrite(D3, HIGH);
    delay(25);

    smarties.getWebServer().on("/open", openGate);
	smarties.getWebServer().on("/open-pedestrian", openGatePedestrian);
	smarties.getWebServer().on("/stop", stopGate);
	smarties.getWebServer().on("/ping", ping);
}

void loop() {
    smarties.getWebServer().handleClient();
}
