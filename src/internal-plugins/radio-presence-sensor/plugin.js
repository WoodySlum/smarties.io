"use strict";

const LOCK_TIME = 60;

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Radio presence form sensor
     *
     * @class
     */
    class RadioPresenceSensorForm extends api.exported.PresenceSensorForm {
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
         * @returns {RadioPresenceSensorForm}                 The instance
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
         * @returns {RadioPresenceSensorForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }

    api.sensorAPI.registerForm(RadioPresenceSensorForm);

    /**
     * This class is overloaded by sensors
     *
     * @class
     */
    class RadioPresenceSensor extends api.exported.PresenceSensor {
        /**
         * Radio presence sensor class
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for sensor
         * @returns {RadioPresenceSensor}                                                       The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
            this.lastEmitted = 0;
            const self = this;
            api.exported.Radio.registerSensor(api, this, (radioObj) => {
                const timestamp = api.exported.DateUtils.class.timestamp();
                if (self.lastEmitted < (timestamp - LOCK_TIME)) {
                    if (radioObj.value > 0) {
                        self.setValue(LOCK_TIME);
                        self.lastEmitted = timestamp;
                    } else {
                        self.setValue(0);
                    }
                }
            });
        }
    }

    api.sensorAPI.registerClass(RadioPresenceSensor);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "radio-presence-sensor",
    version: "0.0.0",
    category: "sensor",
    description: "Radio presence sensor",
    dependencies:["presence-sensor"]
};
