"use strict";
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class is extended by sensors
     *
     * @class
     */
    class TimeSensorForm extends api.exported.SensorForm {
        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {TimeSensorForm}      An instance
         */
        json(data) {
            return new TimeSensorForm(data.id, data.plugin, data.name, data.dashboard, data.statistics, data.dashboardColor, data.statisticsColor);
        }
    }

    api.sensorAPI.registerForm(TimeSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class TimeSensor extends api.exported.Sensor {
        /**
         * Presence sensor class (should be extended)
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {PresenceSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, "TIME", configuration, api.exported.Icons.icons["clock"], 0);
            this.chartType = api.exported.Sensor.constants().CHART_TYPE_BAR;
            this.aggregationMode = api.exported.Sensor.constants().AGGREGATION_MODE_SUM;
            this.unit = api.translateAPI.t("presence.unit.seconds");
            this.addUnitAggregation(api.translateAPI.t("time.unit.minutes"), 1 * 60);
            this.addUnitAggregation(api.translateAPI.t("time.unit.hours"), 1 * 60 * 60);
            this.addUnitAggregation(api.translateAPI.t("time.unit.days"), 1 * 60 * 60 * 24);
            this.addUnitAggregation(api.translateAPI.t("time.unit.months"), 1 * 60 * 60 * 24 * 30);

            this.addClassifier(null, 0.99, 0);
            this.addClassifier(1, null, 1);
        }
    }

    api.sensorAPI.registerClass(TimeSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "time-sensor",
    version: "0.0.0",
    category: "sensor-base",
    description: "Time Sensor base plugin",
    dependencies:["sensor"]
};
