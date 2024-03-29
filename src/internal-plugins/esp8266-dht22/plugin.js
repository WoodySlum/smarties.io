"use strict";
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();
    this.api = api;
    const espPlugin = api.getPluginInstance("esp8266");
    const wiringSchema = api.iotAPI.getWiringSchemaForLib("esp8266");
    wiringSchema.right["D0"].push("Nodemcu pin RST");
    wiringSchema.left["RST"].push("Nodemcu pin D0");
    wiringSchema.right["D6"].push("DHT22 pin #2");
    wiringSchema.left["SD3"].push("DHT22 pin #1");
    wiringSchema.left["GND-1"].push("DHT22 pin #4");
    api.iotAPI.registerApp("app", "esp8266-dht22", "Nodemcu Temperature and humidity sensor", 9, api.iotAPI.constants().PLATFORMS.ESP8266, api.iotAPI.constants().BOARDS.NODEMCU, api.iotAPI.constants().FRAMEWORKS.ARDUINO, ["esp8266"], espPlugin.generateOptions(espPlugin.constants().MODE_DEEP_SLEEP, 20 * 60), wiringSchema);
    api.iotAPI.addIngredientForReceipe("esp8266-dht22", "DHT22", "DHT 22 humidity and temperature sensor", 1, true);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "esp-dht22-sensor",
    version: "0.0.0",
    category: "iot",
    description: "ESP Humidity and temperature sensor",
    dependencies:["esp8266"]
};
