"use strict";

const RANDOM_EXECUTION_THRESHOLD_PERC = 30; // 30%
const MAX_POWERED_ON_DEVICE_S = 2 * 60 * 60; // 2h
const MAX_POWERED_ON_RANDOMIZE_INTERVAL_S = (1 * 60 * 60) + ((60 * 60) / 2); // 1h30

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
    * This class is used for presence simulator form
     *
    * @class
    */
    class PresenceSimulatorForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} enabled       Enable function
         * @param  {Array} includeDevices       The devices to include
         * @returns {PresenceSimulatorForm}              The instance
         */
        constructor(id, enabled, includeDevices) {
            super(id);

            /**
             * @Property("enabled");
             * @Type("string");
             * @Title("presence.simulator.form.enabled");
             * @Enum(["on", "off"]);
             * @EnumNames(["presence.simulator.form.enabled.on", "presence.simulator.form.enabled.off"]);
             * @Default("on");
             * @Display("radio");
             */
            this.enabled = enabled;

            /**
             * @Property("includeDevices");
             * @Title("presence.simulator.form.include.devices");
             * @Type("objects");
             * @Cl("DevicesListSimpleForm");
             */
            this.includeDevices = includeDevices;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {PresenceSimulatorForm}      A form object
         */
        json(data) {
            return new PresenceSimulatorForm(data.id, data.enabled, data.includeDevices);
        }
    }

    api.configurationAPI.register(PresenceSimulatorForm);

    /**
     * This class manage presence simulator extension
     *
     * @class
     */
    class PresenceSimulator {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {PresenceSimulator}     The instance
         */
        constructor(api) {
            this.api = api;
            this.turnOffScheduler = {};

            this.api.timeEventAPI.register((self) => {
                const configuration = api.configurationAPI.getConfiguration();
                api.deviceAPI.getDevices().forEach((device) => {
                    let isIncluded = false;
                    if (configuration && configuration.includeDevices && configuration.includeDevices.length > 0 && api.alarmAPI.alarmStatus()) {
                        configuration.includeDevices.forEach((includeDevice) => {
                            if (includeDevice.identifier === device.id) {
                                isIncluded = true;
                            }
                        });
                    }

                    if (isIncluded) {
                        api.deviceAPI.guessDeviceStatus(api.exported.DateUtils.class.roundedTimestamp(api.exported.DateUtils.class.timestamp(), api.exported.DateUtils.ROUND_TIMESTAMP_HOUR), device.id)
                            .then((state) => {
                                if (state >= api.deviceAPI.constants().INT_STATUS_ON) {
                                    // Add random behavior
                                    const randomExecution = Math.floor(Math.random() * Math.floor(100));
                                    if (randomExecution >= RANDOM_EXECUTION_THRESHOLD_PERC) {
                                        // Setup turnoff
                                        const stopTimestamp = api.exported.DateUtils.class.timestamp() + MAX_POWERED_ON_DEVICE_S - Math.floor(Math.random() * Math.floor(MAX_POWERED_ON_RANDOMIZE_INTERVAL_S));
                                        self.turnOffScheduler[device.id] = stopTimestamp;
                                        api.exported.Logger.info("Presence simulator turned on " + device.name + " turn off planned at " + stopTimestamp);
                                        api.deviceAPI.switchDevice(device.id, api.deviceAPI.constants().INT_STATUS_ON);
                                    }
                                }
                            })
                            .catch((e) => {
                                api.exported.Logger.err(e);
                            });
                    }
                });
            }, this, this.api.timeEventAPI.constants().EVERY_HOURS_INACCURATE);

            this.api.timeEventAPI.register((self) => {
                if (api.alarmAPI.alarmStatus()) {
                    const timestamp = api.exported.DateUtils.class.timestamp();
                    api.deviceAPI.getDevices().forEach((device) => {
                        if (self.turnOffScheduler[device.id] && self.turnOffScheduler[device.id] < timestamp) {
                            api.deviceAPI.switchDevice(device.id, api.deviceAPI.constants().INT_STATUS_OFF);
                            delete self.turnOffScheduler[device.id];
                        }
                    });
                }
            }, this, this.api.timeEventAPI.constants().EVERY_MINUTES);
        }
    }

    api.registerInstance(new PresenceSimulator(api));
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "presence-simulator",
    version: "0.0.0",
    category: "misc",
    description: "Presence Simulator plugin"
};
