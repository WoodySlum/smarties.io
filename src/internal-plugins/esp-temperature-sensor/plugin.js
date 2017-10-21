"use strict";
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Esp temperature form sensor
     * @class
     */
    class EspTemperatureSensorForm extends api.exported.TemperatureSensorForm {
        /**
         * Convert JSON data to object
         *
         * @param  {Object} data Some data
         * @returns {EspTemperatureSensorForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }


    // test
    class Toto extends api.exported.IotForm {
        constructor(id = null, iotApp = null, name = null, test = null) {
            super(id, iotApp, name);

            /**
             * @Property("test");
             * @Title("super test !");
             * @Type("string");
             */
            this.test = test;
        }

        /**
         * Convert JSON data to object
         *
         * @param  {Object} data Some data
         * @returns {EspTemperatureSensorForm}      An instance
         */
        json(data) {

        }
    }

    api.sensorAPI.registerForm(EspTemperatureSensorForm);
    api.iotAPI.registerApp("app", "test", "A test app", 1, "espressif8266_stage", "nodemcuv2", "arduino", ["esp8266"], Toto);

    /**
     * This class is overloaded by sensors
     * @class
     */
    class EspTemperatureSensor extends api.exported.TemperatureSensor {
        /**
         * ESP Temperature sensor class (should be extended)
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {Object} [configuration=null]                                             The configuration for sensor
         * @returns {EspTemperatureSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
        }
    }

    api.sensorAPI.registerClass(EspTemperatureSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "esp-temperature-sensor",
    version: "0.0.0",
    category: "sensor",
    description: "ESP temperature sensor",
    dependencies:["temperature-sensor", "esp8266"]
};
