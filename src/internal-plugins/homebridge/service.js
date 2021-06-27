"use strict";
/* eslint no-underscore-dangle: 0 */
const QRCode = require("qrcode");
const fs = require("fs-extra");
const User = require("./../../../node_modules/homebridge/lib/user").User;
const gm = require("gm");
const port = 51826;
const START_DELAY_S = 30;

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    /**
     * This class starts the homebridge service
     *
     * @class
     */
    class HomebridgeService extends api.exported.Service.class {
        /**
         * The homebridge service
         *
         * @param {Homebridge} plugin  An homebridge plugin
         * @returns {HomebridgeService} The instance
         */
        constructor(plugin) {
            super("homebridge", api.servicesManagerAPI.getThreadsManager(), api.exported.Service.SERVICE_MODE_THREADED);
            this.plugin = plugin;
            this.api = api;
            this.devices = [];
            this.sensors = [];
            this.cameras = [];
            this.startDelay = null;
        }

        /**
         * Run function prototype threaded
         * Should be overloaded by service
         *
         * @param  {object} data    A data passed as initial value
         * @param  {Function} send Send a message to parent process
         */
        run(data, send) {
            this.home = () => {

            };
            this.server = null;
            this.init = (data) => {
                const fs = require("fs-extra");
                const Server = require(data.dirname + "./../../../node_modules/homebridge/lib/server").Server;
                const User = require(data.dirname + "./../../../node_modules/homebridge/lib/user").User;
                const log = require(data.dirname + "./../../../node_modules/homebridge/lib/logger");
                const hap = require("hap-nodejs");
                const pin = "021-92-283";
                const accessories = data.devices.concat(data.sensors);

                log.Logger.prototype.log = (level, msg, ...params) => {
                    msg = "Homebridge - " + msg;
                    if (level === "debug") {
                        send({action: "log", level: 5, msg: msg, params: params});
                    } else if (level === "warn") {
                        send({action: "log", level: 2, msg: msg, params: params});
                    } else if (level === "error") {
                        send({action: "log", level: 1, msg: msg, params: params});
                    } else {
                        send({action: "log", level: 3, msg: msg, params: params});
                    }
                };
                Server.prototype._printPin = (pin) => {
                    send({action: "log", level: 3, msg: "Homebridge pin : " + pin, params: null});
                };
                Server.prototype._printSetupInfo = () => {};

                const insecureAccess = true;
                const conf = data.configuration;
                if (!conf.homebridgeIdentifier) {
                    const hid = data.smartiesId;
                    // conf.homebridgeIdentifier = hid.substr(3,2) + ":" + hid.substr(2,2)  + ":" + hid.substr(4,2)  + ":" + hid.substr(6,2) + ":" + hid.substr(10,2) + ":" + hid.substr(8,2);
                    conf.homebridgeIdentifier = hid.substr(0,2) + ":" + hid.substr(2,2)  + ":" + hid.substr(4,2)  + ":" + hid.substr(6,2) + ":" + hid.substr(10,2) + ":" + hid.substr(8,2);
                    send({action: "saveConf", configuration:conf});
                }

                const platforms = [{platform:"Camera-ffmpeg", cameras: data.cameras}];
                if (conf.alexaUsername && conf.alexaPassword) {
                    platforms.push({
                        platform: "Alexa",
                        name: "Alexa",
                        username: conf.alexaUsername,
                        password: conf.alexaPassword,
                        pin: pin
                        // ,debug: true
                    });
                }

                try {
                    try {
                        fs.mkdirSync(User.persistPath());
                    } catch(e) {
                        send({action: "log", level: 2, msg: e, params:null});
                    }

                    try {
                        hap.init(User.persistPath());
                    } catch(e) {
                        send({action: "log", level: 1, msg: e, params:null});
                    }

                    let config = {
                        bridge: {
                            name: "Smarties",
                            username: conf.homebridgeIdentifier.toUpperCase(),
                            port: data.port,
                            pin: pin
                        },
                        accessories: accessories,
                        platforms: platforms
                    };
                    fs.writeFileSync(User.configPath(), JSON.stringify(config));
                    this.server = new Server({insecureAccess:insecureAccess, customPluginPath: data.dirname + "/homebridge-plugins"});
                } catch(e) {
                    send({action: "log", level: 1, msg: e, params:null});
                }

                if (this.server) {
                    try {
                        this.server.start().then(() => {
                            this.server.api.setMaxListeners(1000);
                            this.server.api.on("getDeviceById", (d) => {
                                send({action: "getDeviceById", device:d});
                            });

                            this.server.api.on("switchDeviceWithDevice", (d) => {
                                send({action: "switchDeviceWithDevice", device:d});
                            });

                            this.server.api.on("getDeviceStatus", (d) => {
                                send({action: "getDeviceStatus", device:d});
                            });

                            this.server.api.on("getDeviceTypes", (d) => {
                                send({action: "getDeviceTypes", device: d});
                            });

                            this.server.api.on("getValue", (d) => {
                                send({action: "getValue", sensor: d});
                            });

                            if (conf && (typeof conf.displayHomekitTile === "undefined" || conf.displayHomekitTile)) {
                                send({action: "showQr", setupUri:this.server.bridgeService.bridge.setupURI(), pin:this.server.config.bridge.pin});
                            }
                        })
                            .catch((e) => {
                                send({action: "log", level: 1, msg: e, params:null});
                            });

                    } catch(e) {
                        send({action: "log", level: 1, msg: e, params:null});
                    }

                }
            };
            this.getDeviceById = (data) => {
                this.server.api.emit("getDeviceByIdRes", data);
            };
            this.getDeviceStatus = (data) => {
                this.server.api.emit("getDeviceStatusRes", data);
            };
            this.getDeviceTypes = (data) => {
                this.server.api.emit("getDeviceTypesRes", data);
            };
            this.getValue = (data) => {
                this.server.api.emit("getValueRes", data);
            };
        }

        /**
         * Retrieve data from process
         * Should be overloaded by service
         *
         * @param  {object} data    A data passed as initial value
         * @param  {ThreadsManager} threadManager    The thread manager
         * @param  {bject} context    A data passed as initial value
         */
        threadCallback(data, threadManager, context) {
            if (data.action === "saveConf") {
                api.configurationAPI.saveData(data.configuration);
            } else if (data.action == "log") {
                if (data.params) {
                    api.exported.Logger.log(data.msg, data.level, ...data.params);
                } else {
                    api.exported.Logger.log(data.msg, data.level);
                }

            } else if (data.action === "showQr") {
                QRCode.toDataURL(data.setupUri, { errorCorrectionLevel: "L", color:{light:api.themeAPI.getColors().primaryColor + "FF", dark:api.themeAPI.getColors().darkenColor +"FF"}, margin:18}, (err, idata) => {
                    if (!err && idata) {
                        const buf = Buffer.alloc(idata.split(",")[1].length, idata.split(",")[1], "base64");
                        gm(buf)
                            .stroke(api.themeAPI.getColors().darkenColor)
                            .font("./res/fonts/OpenSans-Light.ttf", 8)
                            .drawText(90, 165, data.pin)
                            .setFormat("png")
                            .toBuffer((err, buffer) => {
                                if (err) {
                                    api.exported.Logger.err(err);
                                } else {
                                    const tile = api.dashboardAPI.Tile("homebridge-code", api.dashboardAPI.TileType().TILE_PICTURE_TEXT, null, null, "Homekit", null, buffer.toString("base64"), null, null, 99999999);
                                    tile.colors.colorContent = api.themeAPI.getColors().darkColor;

                                    api.dashboardAPI.registerTile(tile);
                                }
                            });
                    } else {
                        api.exported.Logger.err(err);
                    }
                });
            } else if (data.action === "getDeviceById") {
                const device = context.api.deviceAPI.getDeviceById(data.device.id);
                context.send("getDeviceById", {device: device, constants: context.api.deviceAPI.constants()});
            } else if (data.action === "switchDeviceWithDevice") {
                context.api.deviceAPI.switchDeviceWithDevice(data.device);
            } else if (data.action === "getDeviceStatus") {
                context.send("getDeviceStatus", {device: context.api.deviceAPI.getDeviceById(data.device.id), status: context.api.deviceAPI.getDeviceStatus(data.device.id)});
            } else if (data.action === "getDeviceTypes") {
                context.send("getDeviceTypes", {device: context.api.deviceAPI.getDeviceById(data.device.id), deviceTypes: context.api.deviceAPI.getDeviceTypes(data.device), constants: context.api.deviceAPI.constants()});
            } else if (data.action === "getValue") {
                context.api.sensorAPI.getValue(data.sensor, (err, res) => {
                    let tValue = null;
                    if (res) {
                        if (context.api.exported.DateUtils.class.timestamp() - context.api.exported.DateUtils.class.dateToTimestamp(res.timestamp) < (2 * 60 * 60)) { // 2 hour
                            tValue = res.value;
                        }
                    }

                    context.send("getValue", {sensor: data.sensor, err:err, res: res, tValue: tValue});
                });
            } else {
                api.exported.Logger.err(data);
            }
        }



        /**
         * Init homebridge context
         *
         * @param {Array} devices A list of hap devices
         * @param {Array} sensors A list of hap sensors
         * @param {Array} cameras A list of cameras
         */
        init(devices, sensors, cameras) {
            this.devices = devices;
            this.sensors = sensors;
            this.cameras = cameras;
        }

        /**
         * Clear homebridge cache
         */
        clearCache() {
            try {
                const path = User.persistPath();
                api.exported.Logger.info("Clear homebridge cache at path : " + path);
                fs.removeSync(path);
            } catch(e) {
                api.exported.Logger.err(e.message);
            }
        }

        /**
         * Generates a random number
         *
         * @returns {string} A random number
         */
        randomNumber() {
            return Math.floor(Math.random()*9+1).toString();
        }

        /**
         * Start the service
         *
         * @param  {Function} update Update devices and sensors function
         */
        start(update) {
            if (this.startDelay) {
                api.exported.TimerWrapper.class.clearTimeout(this.startDelay);
            }
            this.startDelay = api.exported.TimerWrapper.class.setTimeout(() => {
                if (update) {
                    update();
                }
                this.startDelay = null;
                super.start();
                this.send("init", {configuration: (api.configurationAPI.getConfiguration() ? api.configurationAPI.getConfiguration() : {}), smartiesId: api.environmentAPI.getFullSmartiesId(), dirname: __dirname, port: port, devices: this.devices, sensors: this.sensors, cameras: this.cameras});
            }, START_DELAY_S * 1000);
        }

        /**
         * Stop the service
         */
        stop() {
            super.stop();
        }
    }

    return HomebridgeService;
}

module.exports = loaded;
