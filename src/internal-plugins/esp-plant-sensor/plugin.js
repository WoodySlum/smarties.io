"use strict";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Esp humidity form sensor
     *
     * @class
     */
    class EspPlantSensorForm extends api.exported.PlantSensorForm {

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {EspPlantSensorForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }

    api.sensorAPI.iotAppPowered();
    api.sensorAPI.registerForm(EspPlantSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class EspPlantSensor extends api.exported.PlantSensor {
        /**
         * ESP Humidity sensor class (should be extended)
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {EspPlantSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
            this.dashboardGranularity = 7 * 60 * 60;
        }

    }

    api.sensorAPI.registerClass(EspPlantSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "esp-plant-sensor",
    version: "0.0.0",
    category: "sensor",
    description: "ESP soil hygrometer plant sensor",
    dependencies:["plant-sensor", "esp8266-soil-hygrometer"]
};
