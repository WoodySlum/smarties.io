"use strict";
/* eslint no-underscore-dangle: 0 */
const hap = require("hap-nodejs");
const QRCode = require("qrcode");
const Server = require("./../../../node_modules/homebridge/lib/server").Server;
const Plugin = require("./../../../node_modules/homebridge/lib/plugin").Plugin;
const User = require("./../../../node_modules/homebridge/lib/user").User;
const log = require("./../../../node_modules/homebridge/lib/logger");
const port = 51826;

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    /**
     * This class starts the homebridge service
     * @class
     */
    class HomebridgeService extends api.exported.Service.class {
        /**
         * The homebridge service
         *
         * @param {Homebridge} plugin  An homebridge plugin
         * @param {Array} devices A list of hap devices
         * @returns {HomebridgeService} The instance
         */
        constructor(plugin, devices) {
            super("homebridge");
            this.plugin = plugin;
            var insecureAccess = false;
            this.removeLogs();

            Plugin.addPluginPath(__dirname + "/homebridge-plugins/homebridge-hautomation-lights");
            const hid = api.environmentAPI.getFullHautomationId();
            const uname = hid.substr(0,2) + ":" + hid.substr(2,2)  + ":" + hid.substr(4,2)  + ":" + hid.substr(6,2) + ":" + hid.substr(8,2) + ":" + hid.substr(10,2);

            this.server = new Server(insecureAccess);
            this.server._config = {
                bridge: {
                    name: "Hautomation",
                    username: uname.toUpperCase(),
                    port: port,
                    pin: this.randomNumber() + this.randomNumber() + this.randomNumber() + "-" + this.randomNumber() + this.randomNumber() + "-" + this.randomNumber() + this.randomNumber() + this.randomNumber()
                },
                accessories: devices
            };
            hap.init(User.persistPath());
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
            this.server.run();
            QRCode.toDataURL(this.server._bridge.setupURI(), { errorCorrectionLevel: "L", color:{light:api.themeAPI.getColors().clearColor + "FF", dark:api.themeAPI.getColors().tertiaryColor +"FF"}, margin:18}, (err, data) => {
                if (!err && data) {
                    const tile = api.dashboardAPI.Tile("homebridge", api.dashboardAPI.TileType().TILE_PICTURE_TEXT, null, null, "Homekit", null, data.split(",")[1], null, null, 99999999);
                    tile.colors.colorContent = api.themeAPI.getColors().tertiaryColor;
                    api.dashboardAPI.registerTile(tile);
                }
            });



        }

        /**
         * Stop the service
         */
        stop() {
            const tile = api.dashboardAPI.Tile("homebridge", api.dashboardAPI.TileType().TILE_PICTURE_TEXT);
            api.dashboardAPI.unregisterTile(tile);
            api.exported.Logger.info("Stopping homebridge server");
            this.server._teardown();
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
                    api.exported.Logger.error(msg, params);
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
