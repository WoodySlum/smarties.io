"use strict";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Radio light form sensor
     *
     * @class
     */
    class RadioLightSensorForm extends api.exported.LightSensorForm {
        /**
         * Radio presence sensor form
         *
         * @param  {number} id              An identifier
         * @param  {string} plugin          A plugin
         * @param  {string} name            Sensor's name
         * @param  {boolean} dashboard       True if display on dashboard, otherwise false
         * @param  {boolean} statistics      True if display on statistics, otherwise false
         * @param  {string} dashboardColor  The dashboard color
         * @param  {string} statisticsColor The statistics color
         * @param  {Array} radio The radio objects
         * @returns {RadioLightSensorForm}                 The instance
         */
        constructor(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor, radio) {
            super(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor);

            /**
             * @Property("radio");
             * @Type("objects");
             * @Cl("RadioForm");
             * @Title("device.form.radio");
             * @Default([]);
             */
            this.radio = radio;
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {RadioLightSensorForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }

    api.sensorAPI.registerForm(RadioLightSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class RadioLightSensor extends api.exported.LightSensor {
        /**
         * Radio light sensor class
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {RadioLightSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
            api.exported.Radio.registerSensor(api, this);
        }
    }

    api.sensorAPI.registerClass(RadioLightSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "radio-light-sensor",
    version: "0.0.0",
    category: "sensor",
    description: "Radio light sensor",
    dependencies:["light-sensor"]
};
