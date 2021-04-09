"use strict";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Robonect time form sensor
     *
     * @class
     */
    class RobonectTimeSensorForm extends api.exported.TimeSensorForm {
        /**
         * Robonect time sensor form
         *
         * @param  {number} id              An identifier
         * @param  {string} plugin          A plugin
         * @param  {string} name            Sensor's name
         * @param  {boolean} dashboard       True if display on dashboard, otherwise false
         * @param  {boolean} statistics      True if display on statistics, otherwise false
         * @param  {string} dashboardColor  The dashboard color
         * @param  {string} statisticsColor The statistics color
         * @returns {RobonectTimeSensorForm}                 The instance
         */
        constructor(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor) {
            super(id, plugin, name, dashboard, statistics, dashboardColor, statisticsColor);
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {RobonectTimeSensorForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }

    api.sensorAPI.registerForm(RobonectTimeSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class RobonectTimeSensor extends api.exported.TimeSensor {
        /**
         * Robonect time sensor class
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {RobonectTimeSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
            this.chartType = api.exported.Sensor.constants().CHART_TYPE_LINE;
            this.aggregationMode = api.exported.Sensor.constants().AGGREGATION_MODE_MAX;

            api.timeEventAPI.register((self) => {
                const plugin = api.getPluginInstance("robonect");
                if (plugin && plugin.hours != null) {
                    self.setValue((parseInt(plugin.hours) * 60 * 60));
                }

            }, this, api.timeEventAPI.constants().EVERY_HOURS_INACCURATE);
        }
    }

    api.sensorAPI.registerClass(RobonectTimeSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "robonect-time-sensor",
    version: "0.0.0",
    category: "sensor",
    description: "Robonect time usage sensor",
    dependencies:["time-sensor", "robonect"]
};
