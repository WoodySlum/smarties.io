"use strict";
const CloudTuya = require("cloudtuya");
const CREDENTIAL_RETENTION_TIME_S = 8 * 60 * 60;

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    api.init();

    /**
     * This class is used for TpLink TL-MR6400 form
     *
     * @class
     */
    class TuyaForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} username The username
         * @param  {string} password The password
         * @returns {TuyaForm}              The instance
         */
        constructor(id, username, password) {
            super(id);

            /**
             * @Property("username");
             * @Type("string");
             * @Title("tuya.cloud.username");
             */
            this.username = username;

            /**
             * @Property("password");
             * @Type("string");
             * @Title("tuya.cloud.password");
             * @Display("password");
             */
            this.password = password;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {TuyaForm}      A form object
         */
        json(data) {
            return new TuyaForm(data.id, data.username, data.password);
        }
    }

    api.configurationAPI.register(TuyaForm);

    /**
     * This class manage Tuya device form configuration
     *
     * @class
     */
    class TuyaDeviceForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param {string} tuyaId  The device identifier
         * @returns {TuyaDeviceForm}        The instance
         */
        constructor(id, tuyaId) {
            super(id);

            /**
             * @Property("tuyaId");
             * @Type("string");
             * @Title("tuya.device.id");
             * @Enum("getTuyaIds");
             * @EnumNames("getTuyaIdsLabels");
             */
            this.tuyaId = tuyaId;
        }

        /**
         * Form injection method for ports
         *
         * @param  {...object} inject The ports list array
         * @returns {Array}        An array of ports
         */
        static getTuyaIds(...inject) {
            return inject[0];
        }

        /**
         * Form injection method for ports name
         *
         * @param  {...object} inject The ports name list array
         * @returns {Array}        An array of ports name
         */
        static getTuyaIdsLabels(...inject) {
            return inject[1];
        }

        /**
         * Convert a json object to HueForm object
         *
         * @param  {object} data Some data
         * @returns {TuyaDeviceForm}      An instance
         */
        json(data) {
            return new TuyaDeviceForm(data.id, data.tuyaId);
        }
    }

    /**
     * This class manage Tuya devices (outlets, ...)
     *
     * @class
     */
    class TuyaDevice {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The core APIs
         * @returns {TuyaDevice}        The instance
         */
        constructor(api) {
            this.api = api;
            this.tuyaDevices = [];

            api.timeEventAPI.register((self) => {
                api.exported.Logger.verbose("Synchronizing tuya devices");
                self.retrieveDevicesAndStates();
                self.updateLocalState(self);
            }, this, api.timeEventAPI.constants().EVERY_FIVE_MINUTES);

            this.tuyaApi = null;
            this.lastLogin = 0;

            this.registerSwitchCommand(); // For init
            this.retrieveDevicesAndStates();

            this.api.configurationAPI.setUpdateCb(() => {
                this.retrieveDevicesAndStates();
            });
        }

        /**
         * Authenticate mechanism
         *
         * @param  {Function} [cb] The callback
         */
        authenticate(cb) {
            const self = this;
            if ((self.lastLogin + CREDENTIAL_RETENTION_TIME_S) > api.exported.DateUtils.class.timestamp()) {
                cb(self);
            } else {
                self.tuyaApi.login().then(() => {
                    self.lastLogin = api.exported.DateUtils.class.timestamp();
                    cb(self);
                })
                    .catch((e) => {
                        self.api.exported.Logger.err(e);
                    });
            }
        }

        /**
         * Register switch command
         */
        registerSwitchCommand() {
            const tuyaIds = [];
            const tuyaIdsLabels = [];
            this.tuyaDevices.forEach((tuyaDevice) => {
                tuyaIds.push(tuyaDevice.id);
                tuyaIdsLabels.push(tuyaDevice.name + " - " + tuyaDevice.id + " (" + tuyaDevice.ha_type + ")");
            });

            this.api.deviceAPI.addForm("tuyaDevice", TuyaDeviceForm, "tuya.form.title", true, tuyaIds, tuyaIdsLabels);
            this.api.deviceAPI.registerSwitchDevice("tuyaDevice", (device, formData, deviceStatus) => {
                if (formData && formData.length > 0) {
                    // let hasFailed = false;
                    for (let i = 0 ; i < formData.length ; i++) {
                        const tuyaConfig = formData[i];
                        if (tuyaConfig && tuyaConfig.tuyaId) {
                            const configuration = this.api.configurationAPI.getConfiguration();
                            if (configuration && configuration.username && configuration.password) {
                                this.authenticate((self) => {
                                    self.tuyaApi.setState({devId: tuyaConfig.tuyaId, setState: ((deviceStatus.getStatus() === api.deviceAPI.constants().INT_STATUS_ON) ? 1 : 0)}).then((r) => {
                                        if (r && r.header && r.header.code === "SUCCESS") {
                                            self.api.exported.Logger.info("Tuya device sucessfully updated");
                                            // Update local state
                                            for (let i = 0 ; i < this.tuyaDevices.length ; i++) {
                                                if (self.tuyaDevices[i].id === tuyaConfig.tuyaId) {
                                                    self.tuyaDevices[i].data.state = ((deviceStatus.getStatus() === api.deviceAPI.constants().INT_STATUS_ON) ? true : false);
                                                }
                                            }
                                        } else {
                                            self.api.exported.Logger.err("Could not change tuya device status");
                                            self.api.exported.Logger.err(r);
                                            // deviceStatus.status = (deviceStatus.getStatus() === api.deviceAPI.constants().INT_STATUS_ON) ? api.deviceAPI.constants().INT_STATUS_OFF : api.deviceAPI.constants().INT_STATUS_ON;
                                        }
                                    })
                                        .catch((e) => {
                                            self.api.exported.Logger.err(e.message);
                                        });
                                });

                            }
                        } else {
                            api.exported.Logger.warn("Invalid configuration for tuya");
                        }
                    }
                }

                return deviceStatus;
            });
        }

        /**
         * Retrieve device and status
         *
         * @param  {Function} [cb=null] A callback when done. If something wrong occurs, callback won't be called
         */
        retrieveDevicesAndStates(cb = null) {
            const configuration = this.api.configurationAPI.getConfiguration();
            if (configuration && configuration.username && configuration.password) {
                this.tuyaApi = new CloudTuya({
                    userName: configuration.username,
                    password: configuration.password
                });

                this.authenticate((self) => {
                    self.tuyaApi.find().then((r) => {
                        if (!r) {
                            self.api.exported.Logger.err("Error while retrieving tuya devices. Maybe username or password is wrong ...");
                        } else {
                            self.tuyaDevices = r;
                            self.registerSwitchCommand();
                            if (cb) {
                                cb();
                            }
                        }
                    })
                        .catch((e) => {
                            self.api.exported.Logger.err(e.message);
                        });
                });

            }


        }

        /**
         * Update local devices status from Hue APIs
         *
         * @param  {TuyaDevice} [context=null] The context (`this`)
         */
        updateLocalState(context = null) {
            if (!context) {
                context = this;
            }

            // context.retrieveDevicesAndStates(() => {
            //     context.api.deviceAPI.getDevices().forEach((device) => {
            //         let isTuyaDevice = false;
            //         let isOn = context.api.deviceAPI.constants().INT_STATUS_OFF;
            //         if (device && device.TuyaDeviceForm) {
            //             for (let i = 0 ; i < device.TuyaDeviceForm.length ; i++) {
            //                 if (device.TuyaDeviceForm[i] && device.TuyaDeviceForm[i].tuyaId) {
            //                     for (let j = 0 ; j < context.tuyaDevices.length ; j++) {
            //                         if (context.tuyaDevices[j].id === device.TuyaDeviceForm[i].tuyaId) {
            //                             isTuyaDevice = true;
            //                             if (context.tuyaDevices[j].data.state) {
            //                                 isOn = context.api.deviceAPI.constants().INT_STATUS_ON;
            //                             }
            //                         }
            //                     }
            //                 }
            //             }
            //         }
            //
            //         if (isTuyaDevice && device.status != isOn) {
            //             device.status = isOn;
            //             context.api.deviceAPI.switchDeviceWithDevice(device);
            //         }
            //     });
            // });
        }
    }

    new TuyaDevice(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "tuya-device",
    version: "0.0.0",
    category: "device",
    description: "Tuya devices support (outlet, ...) DEPRECATED",
    defaultDisabled: true,
    dependencies:[]
};
