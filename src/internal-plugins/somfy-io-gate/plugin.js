"use strict";

const request = require("request");

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class manage somfy io iot device form configuration
     *
     * @class
     */
    class SomfyIoDeviceForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param {string} iotId  The iot identifier
         * @returns {SomfyIoDeviceForm}        The instance
         */
        constructor(id, iotId) {
            super(id);

            /**
             * @Property("iotId");
             * @Type("string");
             * @Title("somfy.io.iotId.id");
             * @Enum("getIotIds");
             * @EnumNames("getIotIdsLabels");
             */
            this.iotId = iotId;
        }

        /**
         * Form injection method for iotId
         *
         * @param  {...object} inject The id list array
         * @returns {Array}        An array of ports
         */
        static getIotIds(...inject) {
            return inject[0];
        }

        /**
         * Form injection method for iot label
         *
         * @param  {...object} inject The iot name list array
         * @returns {Array}        An array of ports name
         */
        static getIotIdsLabels(...inject) {
            return inject[1];
        }

        /**
         * Convert a json object to SomfyIoDeviceForm object
         *
         * @param  {object} data Some data
         * @returns {SomfyIoDeviceForm}      An instance
         */
        json(data) {
            return new SomfyIoDeviceForm(data.id, data.iotId);
        }
    }

    /**
     * This class manage Roomba esp8266
     *
     * @class
     */
    class SomfyIoGate {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {SomfyIoGate}     The instance
         */
        constructor(api) {
            this.api = api;
            this.api.translateAPI.load();
            const espPlugin = this.api.getPluginInstance("esp8266");
            const wiringSchema = this.api.iotAPI.getWiringSchemaForLib("esp8266");
            wiringSchema.right["D1"].push("Keygo top button - right pin");
            wiringSchema.right["D3"].push("Keygo left button - top pin");
            wiringSchema.right["GND-2"].push("Keygo -");
            wiringSchema.right["3V3-2"].push("Keygo +");
            this.api.iotAPI.registerApp("app", "somfy-io-gate", "Nodemcu somfy keygo", 3, api.iotAPI.constants().PLATFORMS.ESP8266, api.iotAPI.constants().BOARDS.NODEMCU, api.iotAPI.constants().FRAMEWORKS.ARDUINO, ["esp8266"], espPlugin.generateOptions(espPlugin.constants().MODE_ALWAYS_POWERED, 0), wiringSchema);
            this.api.iotAPI.addIngredientForReceipe("somfy-io-gate", "Keygo io 1W", "Remote controller", 1, true);
            this.keygo = null;
            const self = this;
            this.registerDeviceForm();


            this.api.coreAPI.registerEvent(espPlugin.constants().PING_EVENT_KEY, (data) => {
                const iot = self.api.iotAPI.getIot(data.id);
                if (iot && iot.iotApp === "somfy-io-gate") { // This is for me
                    this.keygo = Object.assign(iot, data);
                    self.api.exported.Logger.info("Received new keygo ping " + iot.name);
                    this.registerDeviceForm();
                }
            });

            this.api.webAPI.register(this, this.api.webAPI.constants().POST, ":/keygo/[set]/[action]/", this.api.webAPI.Authentication().AUTH_GUEST_LEVEL);
        }

        /**
         *
         */
        registerDeviceForm() {
            if (this.keygo) {
                const somfyIotIds = [this.keygo.id, this.keygo.id + "-pedestrian", this.keygo.id + "-stop"];
                const somfyIotLabels = [this.keygo.name + " (" + api.translateAPI.t("somfy.io.all")+ ")", this.keygo.name + " (" + api.translateAPI.t("somfy.io.pedestrian")+ ")", this.keygo.name + " (" + api.translateAPI.t("somfy.io.stop")+ ")"];
                api.deviceAPI.addForm("somfyIoDevice", SomfyIoDeviceForm, "somfy.io.device.form.title", false, somfyIotIds, somfyIotLabels);
                api.deviceAPI.registerSwitchDevice("somfyIoDevice", (device, formData, deviceStatus) => {
                    if (formData && formData.iotId) {
                        if (formData.iotId === this.keygo.id) {
                            this.openGate();
                        } else if (formData.iotId === this.keygo.id + "-pedestrian") {
                            this.openGate(true);
                        } else if (formData.iotId === this.keygo.id + "-stop") {
                            this.stopGate();
                        }
                    }

                    deviceStatus.setStatus(api.deviceAPI.constants().INT_STATUS_ON);
                    return deviceStatus;
                }, api.deviceAPI.constants().DEVICE_TYPE_GATE);
            }
        }

        /**
         * Open gate
         *
         * @param  {boolean} [pedestrian=false] Mode pedestrian
         * @param  {Function} [cb=null]     The callback function
         */
        openGate(pedestrian = false, cb = null) {
            if (this.keygo) {
                const command = (pedestrian ? "open-pedestrian" : "open");
                this.api.exported.Logger.info("Trigger " + "http://" + this.keygo.ip + "/" + command);
                request("http://" + this.keygo.ip + "/" + command, { }, (err) => {
                    if (err) {
                        api.exported.Logger.err(err);
                        if (cb) cb(err);
                    } else {
                        if (cb) cb(null);
                    }
                });
            } else {
                if (cb) cb(Error("No keygo found"));
            }
        }

        /**
         * Stop gate
         *
         * @param  {Function} [cb=null]     The callback function
         */
        stopGate(cb = null) {
            if (this.keygo) {
                const command = "stop";
                this.api.exported.Logger.info("Trigger " + "http://" + this.keygo.ip + "/" + command);
                request("http://" + this.keygo.ip + "/" + command, { }, (err) => {
                    if (err) {
                        api.exported.Logger.err(err);
                        if (cb) cb(err);
                    } else {
                        if (cb) cb(null);
                    }
                });
            } else {
                if (cb) cb(Error("No keygo found"));
            }
        }
    }

    new SomfyIoGate(api);

}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "somfy-io-gate",
    version: "0.0.0",
    category: "iot",
    description: "Manage somfy io gate",
    dependencies:["esp8266"]
};
