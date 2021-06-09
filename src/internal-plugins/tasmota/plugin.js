"use strict";
const request = require("request");

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    api.init();

    /**
     * This class manage Tuya device form configuration
     *
     * @class
     */
    class TasmotaDeviceForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param {string} tasmotaIp  The device ip
         * @returns {TasmotaDeviceForm}        The instance
         */
        constructor(id, tasmotaIp) {
            super(id);

            /**
             * @Property("tasmotaIp");
             * @Type("object");
             * @Cl("IpScanForm");
             */
            this.tasmotaIp = tasmotaIp;
        }

        /**
         * Convert a json object
         *
         * @param  {object} data Some data
         * @returns {TasmotaDeviceForm}      An instance
         */
        json(data) {
            return new TasmotaDeviceForm(data.id, data.tasmotaIp);
        }
    }

    /**
     * This class manage Tasmota devices
     *
     * @class
     */
    class Tasmota {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The core APIs
         * @returns {Tasmota}        The instance
         */
        constructor(api) {
            this.api = api;

            this.updateStatus();
            this.api.timeEventAPI.register(() => {
                this.updateStatus();
            }, this, this.api.timeEventAPI.constants().EVERY_MINUTES);

            this.api.deviceAPI.addForm("tasmotaDevice", TasmotaDeviceForm, "tasmota.form.title", true);
            this.api.deviceAPI.registerSwitchDevice("tasmotaDevice", (device, formData, deviceStatus) => {
                if (formData && formData.length > 0) {
                    for (let i = 0 ; i < formData.length ; i++) {
                        let ip = null;
                        if (formData[i].tasmotaIp && formData[i].tasmotaIp.ip && formData[i].tasmotaIp.ip != "freetext") {
                            ip = formData[i].tasmotaIp.ip;
                        } else if (formData[i].tasmotaIp && formData[i].tasmotaIp.ip && formData[i].tasmotaIp.ip == "freetext" && formData[i].tasmotaIp.freetext) {
                            ip = formData[i].tasmotaIp.freetext;
                        }

                        if (ip != null) {
                            let url = null;
                            if (deviceStatus.status == api.deviceAPI.constants().INT_STATUS_ON) {
                                url = "http://" + ip + "/cm?user=admin&password=joker&cmnd=Backlog%20Power%20Toggle%3BPower1%20on";
                            } else if (deviceStatus.status == api.deviceAPI.constants().INT_STATUS_OFF) {
                                url = "http://" + ip + "/cm?user=admin&password=joker&cmnd=Backlog%20Power%20Toggle%3BPower1%20off";
                            }

                            if (url) {
                                request(url);
                            } else {
                                api.exported.Logger.err("Unknown URL");
                            }

                        } else {
                            api.exported.Logger.err("Unknown ip");
                        }
                    }
                }
            });
        }

        /**
         * Update device status
         */
        updateStatus() {
            this.api.deviceAPI.getDevices().forEach((device) => {
                if (device && device.TasmotaDeviceForm) {
                    device.TasmotaDeviceForm.forEach((tasmotaDevice) => {
                        let ip = null;
                        if (tasmotaDevice.tasmotaIp && tasmotaDevice.tasmotaIp.ip && tasmotaDevice.tasmotaIp.ip != "freetext") {
                            ip = tasmotaDevice.tasmotaIp.ip;
                        } else if (tasmotaDevice.tasmotaIp && tasmotaDevice.tasmotaIp.ip && tasmotaDevice.tasmotaIp.ip == "freetext" && tasmotaDevice.tasmotaIp.freetext) {
                            ip = tasmotaDevice.tasmotaIp.freetext;
                        }

                        if (ip != null) {
                            let url = "http://" + ip + "/cm?user=admin&password=joker&cmnd=Power";
                            request(url, { json: true }, (err, res, body) => {
                                if (!err && body) {
                                    if (body.POWER == "OFF") {
                                        device.status = api.deviceAPI.constants().INT_STATUS_OFF;
                                    } else if (body.POWER == "ON") {
                                        device.status = api.deviceAPI.constants().INT_STATUS_ON;
                                    }
                                    api.deviceAPI.saveDevice(device);
                                }

                            });
                        } else {
                            api.exported.Logger.err("Unknown ip");
                        }
                    });
                }
            });

        }
    }

    new Tasmota(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "tasmota-device",
    version: "0.0.0",
    category: "device",
    description: "Tasmota devices support",
    defaultDisabled: true,
    dependencies:[]
};
