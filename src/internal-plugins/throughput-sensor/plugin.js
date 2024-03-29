"use strict";
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class is extended by throughput sensors
     *
     * @class
     */
    class ThroughputSensorForm extends api.exported.SensorForm {
        /**
         * Sensor form
         *
         * @param  {number} id              An identifier
         * @param  {string} plugin          A plugin
         * @param  {string} name            Sensor's name
         * @param  {boolean} dashboard       True if display on dashboard, otherwise false
         * @param  {boolean} statistics      True if display on statistics, otherwise false
         * @param  {string} dashboardColor  The dashboard color
         * @param  {string} statisticsColor The statistics color
         * @returns {ThroughputSensorForm}                 The instance
         */
        constructor(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor) {
            super(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor);
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {ThroughputSensorForm}      An instance
         */
        json(data) {
            return new ThroughputSensorForm(data.id, data.plugin, data.name, data.dashboard, data.statistics, data.dashboardColor, data.statisticsColor);
        }
    }

    api.sensorAPI.registerForm(ThroughputSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class ThroughputSensor extends api.exported.Sensor {
        /**
         * Throughput sensor class (should be extended)
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {ThroughputSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, "THROUGHPUT", configuration, api.exported.Icons.icons["throughput"], 0);
            this.unit = "kBs";
            this.addUnitAggregation("mB/s", 1024);
            this.addClassifier(null, 1024, 1024);
            this.addClassifier(1025, 10240, 10240);
            this.addClassifier(10241, 30720, 30720);
            this.addClassifier(30721, 81920, 81920);
            this.addClassifier(81921, 122880, 122880);
            this.addClassifier(122881, null, 204800);
        }
    }

    api.sensorAPI.registerClass(ThroughputSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "throughput-sensor",
    version: "0.0.0",
    category: "sensor-base",
    description: "Throughput Sensor base plugin",
    dependencies:["sensor"]
};
