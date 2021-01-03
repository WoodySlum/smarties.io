"use strict";
/* eslint no-underscore-dangle: 0 */
const hap = require("hap-nodejs");
const QRCode = require("qrcode");
const fs = require("fs-extra");
const sha256 = require("sha256");
const Server = require("./../../../node_modules/homebridge/lib/server").Server;
const Plugin = require("./../../../node_modules/homebridge/lib/plugin").Plugin;
const PluginManager = require("./../../../node_modules/homebridge/lib/pluginManager").PluginManager;
const User = require("./../../../node_modules/homebridge/lib/user").User;
const log = require("./../../../node_modules/homebridge/lib/logger");
const gm = require("gm");
const port = 51826;
const WAIT_FOR_STARTING_SERVICE = 10; // Wait before starting the service (in seconds)

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
         * @param {Array} devices A list of hap devices
         * @param {Array} sensors A list of hap sensors
         * @returns {HomebridgeService} The instance
         */
        constructor(plugin, devices, sensors) {
            super("homebridge");
            this.plugin = plugin;
            this.removeLogs();
            this.init(devices, sensors);
            this.ittt = 0;
            this.startTimer = null;
            this.disableAutoStart = true;
        }

        /**
         * Init homebridge context
         *
         * @param {Array} devices A list of hap devices
         * @param {Array} sensors A list of hap sensors
         */
        init(devices, sensors) {
            const insecureAccess = true;
            this.clearCache();

            // Plugin.addPluginPath(__dirname + "/homebridge-plugins/homebridge-smarties-lights");
            // Plugin.addPluginPath(__dirname + "/homebridge-plugins/homebridge-smarties-temperature");
            // Plugin.addPluginPath(__dirname + "/homebridge-plugins/homebridge-smarties-humidity");
            // Plugin.addPluginPath(__dirname + "/homebridge-plugins/homebridge-smarties-alarm");
            // console.log(PluginManager);
            // PluginManager.loadPlugin(__dirname + "/homebridge-plugins/homebridge-smarties-lights");
            let a = new Plugin("homebridge-smarties-lights", __dirname + "/homebridge-plugins/homebridge-smarties-lights", __dirname + "/homebridge-plugins/homebridge-smarties-lights/package.json");
            // new Plugin("homebridge-smarties-temperature", __dirname + "/homebridge-plugins/homebridge-smarties-temperature", __dirname + "/homebridge-plugins/homebridge-smarties-temperature/package.json");
            // new Plugin("homebridge-smarties-humidity", __dirname + "/homebridge-plugins/homebridge-smarties-humidity", __dirname + "/homebridge-plugins/homebridge-smarties-humidity/package.json");
            // new Plugin("homebridge-smarties-alarm", __dirname + "/homebridge-plugins/homebridge-smarties-alarm", __dirname + "/homebridge-plugins/homebridge-smarties-alarm/package.json");

            const conf = api.configurationAPI.getConfiguration() ? api.configurationAPI.getConfiguration() : {};
            if (!conf.homebridgeIdentifier) {
                const hid = api.environmentAPI.getFullSmartiesId();
                conf.homebridgeIdentifier = hid.substr(0,2) + ":" + hid.substr(2,2)  + ":" + hid.substr(4,2)  + ":" + sha256(Math.floor(Math.random() * 100000000).toString()).substr(0,2) + ":" + sha256(Math.floor(Math.random() * 100000000).toString()).substr(0,2) + ":" + sha256(Math.floor(Math.random() * 100000000).toString()).substr(0,2);
                api.configurationAPI.saveData(conf);
            }

            const platforms = [];
            const pin = "021-92-279";
            if (conf.alexaUsername && conf.alexaPassword) {
                platforms.push({
                    platform: "Alexa",
                    name: "Alexa",
                    username: conf.alexaUsername,
                    password: conf.alexaPassword,
                    pin: pin
                });
            }

            try {
                hap.init(User.persistPath());
                this.server = new Server({insecureAccess:insecureAccess, customPluginPath: __dirname + "/homebridge-plugins"});
                this.server.config = {
                    bridge: {
                        name: "Smarties",
                        username: conf.homebridgeIdentifier.toUpperCase(),
                        port: port,
                        pin: pin
                    },
                    accessories: devices.concat(sensors).concat(alarm),
                    platforms:platforms
                };
            } catch(e) {
                api.exported.Logger.err(e.message);
                api.exported.Logger.err(e.stack);
            }
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
         */
        start() {
            super.start();
            this.startTimer = setTimeout((self) => {
                if (self.server) {
                    try {
                        self.server.publishBridge();
                        const conf = api.configurationAPI.getConfiguration();
                        if (conf && (typeof conf.displayHomekitTile === "undefined" || conf.displayHomekitTile)) {
                            QRCode.toDataURL(self.server.bridge.setupURI(), { errorCorrectionLevel: "L", color:{light:api.themeAPI.getColors().primaryColor + "FF", dark:api.themeAPI.getColors().darkenColor +"FF"}, margin:18}, (err, data) => {
                                if (!err && data) {
                                    const buf = Buffer.alloc(data.split(",")[1].length, data.split(",")[1], "base64");
                                    gm(buf)
                                    .stroke(api.themeAPI.getColors().darkenColor)
                                    .font("./res/fonts/OpenSans-Light.ttf", 8)
                                    .drawText(90, 165, self.server.bridge._accessoryInfo.pincode)
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
                        }
                    } catch(e) {
                        api.exported.Logger.err(e.message);
                    }

                }
            }, WAIT_FOR_STARTING_SERVICE * 1000, this);
        }

        /**
         * Stop the service
         */
        stop() {
            if (this.startTimer) {
                clearTimeout(this.startTimer);
            }
            api.dashboardAPI.unregisterTile("homebridge-code");
            api.exported.Logger.info("Stopping homebridge server");
            if (this.server) {
                this.server.teardown();
            }
            this.server = null;
            super.stop();
        }

        /**
         * Get the pin code
         */
        getPin() {
            return (this.server ? this.server._config.bridge.pin : null);
        }

        /**
         * Remove logs
         */
        removeLogs() {
            log.Logger.prototype.log = (level, msg, ...params) => {
                msg = "Homebridge - " + msg;
                if (level === "debug") {
                    api.exported.Logger.debug(msg, params);
                } else if (level === "warn") {
                    api.exported.Logger.warn(msg, params);
                } else if (level === "error") {
                    api.exported.Logger.err(msg, params);
                } else {
                    api.exported.Logger.info(msg, params);
                }
            };
            Server.prototype._printPin = (pin) => {
                api.exported.Logger.info("Homebridge pin : " + pin);
            };
            Server.prototype._printSetupInfo = () => {};
        }

    }

    return HomebridgeService;
}

module.exports = loaded;
