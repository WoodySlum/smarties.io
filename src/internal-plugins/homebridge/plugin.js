"use strict";
const HomebridgeServiceClass = require("./service.js");

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    /**
    * This class is used for Homebridge form
     *
    * @class
    */
    class HomebridgeForm extends api.exported.FormObject.class {
        /**
        * Constructor
        *
        * @param  {number} id           Identifier
        * @param  {string} alexaUsername       The Alexa username
        * @param  {string} alexaPassword       The Alexa password
        * @param  {boolean} displayHomekitTile       The tile value
        * @param  {boolean} clearHomebridgeCache       Clear cache
        * @param  {string}  homebridgeIdentifier       The homebridge identifier - auto filled
        * @returns {HomebridgeForm}              The instance
        */
        constructor(id, alexaUsername, alexaPassword, displayHomekitTile = true, clearHomebridgeCache = false, homebridgeIdentifier = null) {
            super(id);

            /**
            * @Property("alexaUsername");
            * @Type("string");
            * @Title("homebridge.alexa.username");
            */
            this.alexaUsername = alexaUsername;

            /**
            * @Property("alexaPassword");
            * @Type("string");
            * @Display("password");
            * @Title("homebridge.alexa.password");
            */
            this.alexaPassword = alexaPassword;

            /**
            * @Property("displayHomekitTile");
            * @Type("boolean");
            * @Default(true);
            * @Title("homebridge.tile.qr");
            */
            this.displayHomekitTile = displayHomekitTile;

            /**
            * @Property("clearHomebridgeCache");
            * @Type("boolean");
            * @Default(false);
            * @Title("homebridge.clear.cache");
            */
            this.clearHomebridgeCache = clearHomebridgeCache;

            /**
            * @Property("homebridgeIdentifier");
            * @Type("string");
            * @Hidden(true);
            */
            this.homebridgeIdentifier = homebridgeIdentifier;
        }

        /**
        * Convert json data
        *
        * @param  {object} data Some key / value data
        * @returns {HomebridgeForm}      A form object
        */
        json(data) {
            return new HomebridgeForm(data.id, data.alexaUsername, data.alexaPassword, data.displayHomekitTile, data.clearHomebridgeCache, data.homebridgeIdentifier);
        }
    }

    api.configurationAPI.register(HomebridgeForm);

    const HomebridgeService = HomebridgeServiceClass(api);
    /**
     * Class for Homebridge
     *
     * @class
     */
    class Homebridge {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @returns {Homebridge}                                                       The instance
         */
        constructor(api) {
            this.api = api;
            this.devices = [];
            this.sensors = [];
            this.alarm = [];
            this.cameras = [];
            this.camerasToken = api.webAPI.getTokenWithIdentifier("23c3543b", 50000000); // 578 days
            this.generateHapDevices();
            this.generateHapSensors();
            this.generateHapAlarm();
            this.generateHapCameras();

            if (!process.env.TEST) {
                this.service = new HomebridgeService(api, this.devices, this.sensors);
                api.servicesManagerAPI.add(this.service);

                api.coreAPI.registerEvent(api.deviceAPI.constants().EVENT_UPDATE_CONFIG_DEVICES, () => {
                    this.service.stop();
                    this.service.init(this.devices, this.sensors, this.cameras);
                    this.service.start(() => {
                        this.generateHapDevices();
                        this.generateHapSensors();
                        this.generateHapAlarm();
                        this.generateHapCameras();
                        this.service.init(this.devices, this.sensors, this.cameras);
                    });
                });

                api.coreAPI.registerEvent(api.constants().CORE_EVENT_READY, () => {
                    this.service.stop();

                    this.service.start(() => {
                        this.generateHapDevices();
                        this.generateHapSensors();
                        this.generateHapAlarm();
                        this.generateHapCameras();

                        this.service.init(this.devices, this.sensors, this.cameras);

                    });
                });

                api.configurationAPI.setUpdateCb((conf) => {
                    this.service.stop();
                    if (conf.clearHomebridgeCache) {
                        this.service.clearCache();
                        conf.clearHomebridgeCache = false;
                        conf.homebridgeIdentifier = null;
                        api.configurationAPI.saveData(conf);
                    }

                    this.service.init(this.devices, this.sensors, this.cameras);
                    this.service.start(() => {
                        this.generateHapDevices();
                        this.generateHapSensors();
                        this.generateHapAlarm();
                        this.generateHapCameras();

                        this.service.init(this.devices, this.sensors, this.cameras);
                    });
                });
            }
        }

        /**
         * Generate cameras config
         */
        generateHapCameras() {
            this.cameras = [];
            Object.keys(api.cameraAPI.getCameras()).forEach((cameraId) => {
                const camera = api.cameraAPI.getCamera(cameraId);
                let mode = "static";
                let url = api.environmentAPI.getLocalAPIUrl() + "camera/get/" + mode + "/" + cameraId + "/?t=" + this.camerasToken;
                if (camera.rtspSupport()) {
                    url = camera.rtspUrl;
                } else if (camera.mjpegSupport()) {
                    url = camera.mjpegUrl;
                }


                const urlStill = api.environmentAPI.getLocalAPIUrl() + "camera/get/static/" + cameraId + "/?t=" + this.camerasToken;

                this.cameras.push({
                    name: this.api.translateAPI.t("homebridge.camera", camera.configuration.name),
                    videoConfig: {
                        source: "-i " + url,
                        stillImageSource: "-i " + urlStill,
                        maxStreams: 2,
                        maxWidth: 1280,
                        maxHeight: 720,
                        maxFPS: 30
                    }
                });
            });
        }

        /**
         * Generate lights config
         */
        generateHapDevices() {
            this.devices = [];
            this.devicesName = [];

            this.api.deviceAPI.getDevices().forEach((device) => {
                if (device.visible) {
                    let i = 2;
                    let name = device.name;
                    if (this.devicesName.indexOf(name) >= 0) {
                        name = name + " " + i;
                        i++;
                    } else {
                        this.devicesName.push(name);
                    }

                    if (device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_LIGHT_DIMMABLE_COLOR || device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_LIGHT_DIMMABLE || device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_LIGHT || device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_AUTOMATIC_WATERING) {
                        this.devices.push({
                            accessory: "Smarties lights",
                            identifier: device.id,
                            name: name,
                            coreApi: null,
                            status: device.status,
                            device: device,
                            deviceTypes: api.deviceAPI.getDeviceTypes(device),
                            deviceConstants: api.deviceAPI.constants()
                        });
                    } else if (device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_GATE) {
                        this.devices.push({
                            accessory: "Smarties gate",
                            identifier: device.id,
                            name: name,
                            coreApi: null,
                            status: device.status,
                            device: device,
                            deviceTypes: api.deviceAPI.getDeviceTypes(device),
                            deviceConstants: api.deviceAPI.constants()
                        });
                    } else if (device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_SHUTTER) {
                        this.devices.push({
                            accessory: "Smarties shutter",
                            identifier: device.id,
                            name: this.api.translateAPI.t("homebridge.shutter", name),
                            coreApi: null,
                            status: device.status,
                            device: device,
                            deviceTypes: api.deviceAPI.getDeviceTypes(device),
                            deviceConstants: api.deviceAPI.constants()
                        });
                    } else if (device.bestDeviceType == this.api.deviceAPI.constants().DEVICE_TYPE_LOCK) {
                        this.devices.push({
                            accessory: "Smarties lock",
                            identifier: device.id,
                            name: name,
                            coreApi: null,
                            status: device.status,
                            device: device,
                            deviceTypes: api.deviceAPI.getDeviceTypes(device),
                            deviceConstants: api.deviceAPI.constants()
                        });
                    }
                }
            });
        }

        /**
         * Generate alarm config
         */
        generateHapAlarm() {
            this.alarm = [];
            this.alarm.push({
                accessory: "Smarties alarm",
                name: api.translateAPI.t("alarm.tile.title")
            });
        }

        /**
         * Generate lights config
         */
        generateHapSensors() {
            this.sensors = [];
            this.sensorsName = [];
            let i = 2;
            const temperatureSensors = this.api.sensorAPI.getSensors("TEMPERATURE");
            Object.keys(temperatureSensors).forEach((sensorKey) => {
                let sensor = this.api.translateAPI.t("homebridge.sensor", temperatureSensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties temperature sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const humiditySensors = this.api.sensorAPI.getSensors("HUMIDITY");
            Object.keys(humiditySensors).forEach((sensorKey) => {

                let sensor = this.api.translateAPI.t("homebridge.sensor", humiditySensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties humidity sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const contactSensors = this.api.sensorAPI.getSensors("CONTACT");
            Object.keys(contactSensors).forEach((sensorKey) => {

                let sensor = this.api.translateAPI.t("homebridge.sensor", contactSensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties contact sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const presenceSensors = this.api.sensorAPI.getSensors("PRESENCE");
            Object.keys(presenceSensors).forEach((sensorKey) => {

                let sensor = this.api.translateAPI.t("homebridge.sensor", presenceSensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties motion sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const lightSensors = this.api.sensorAPI.getSensors("LIGHT");
            Object.keys(lightSensors).forEach((sensorKey) => {

                let sensor = this.api.translateAPI.t("homebridge.sensor", lightSensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties light sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const waterLeakSensors = this.api.sensorAPI.getSensors("WATER-LEAK");
            Object.keys(waterLeakSensors).forEach((sensorKey) => {

                let sensor = this.api.translateAPI.t("homebridge.sensor", waterLeakSensors[sensorKey]);
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties leak sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });

            const smokeSensors = this.api.translateAPI.t("homebridge.sensor", this.api.sensorAPI.getSensors("SMOKE"));
            Object.keys(smokeSensors).forEach((sensorKey) => {

                let sensor = smokeSensors[sensorKey];
                if (this.sensorsName.indexOf(sensor) >= 0) {
                    sensor = sensor + " " + i;
                    i++;
                } else {
                    this.sensorsName.push(sensor);
                }

                this.sensors.push({
                    accessory: "Smarties smoke sensor",
                    identifier: sensorKey,
                    name: sensor
                });
            });


        }

    }

    api.registerInstance(new Homebridge(api));
    api.init();
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "homebridge",
    version: "0.0.0",
    category: "bridge",
    description: "Manage through Apple's HomeKit, Siri and Amazon Alexa",
    dependencies:[],
    classes:[]
};
