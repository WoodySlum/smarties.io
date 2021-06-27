"use strict";

const Logger = require("./../../../logger/Logger");
const Tunnel = require("./Tunnel");
const TimerWrapper = require("./../../../utils/TimerWrapper");
const ngrok = require("ngrok");
const fs = require("fs-extra");

/**
 * This class wraps ngrok tunnel apis
 *
 * @class
 */
class TunnelNgrok extends Tunnel.class {

    /**
     * Constructor
     *
     * @param  {int} port       The web services port
     * @param  {GatewayManager} gatewayManager       The gateway manager
     * @param  {EnvironmentManager} environmentManager       The environment manager
     * @param  {object}   AppConfiguration     The app configuration
     * @param  {Function}   cbTunnelDone     Callback when tunnel is created
     *
     * @returns {TunnelNgrok}            The instance
     */
    constructor(port, gatewayManager, environmentManager, AppConfiguration, cbTunnelDone) {
        super(port, gatewayManager, environmentManager, AppConfiguration, cbTunnelDone);
    }

    /**
     * Start tunnel
     */
    start() {
        super.start();
        TimerWrapper.class.setTimeout(async (self) => {
            // For pkg, copy binary outside container
            const platform = require("os").platform();
            const binExtension = "ngrok" + (platform === "win32" ? ".exe" : "");
            const ngrokBin = self.AppConfiguration.cachePath + binExtension;

            if (!fs.existsSync(ngrokBin)) {
                Logger.info("Copy ngrok bin");
                var binContent = fs.readFileSync(__dirname + "/../../../../node_modules/ngrok/bin/" + binExtension);
                fs.writeFileSync(ngrokBin, binContent);
                fs.chmodSync(self.AppConfiguration.cachePath + binExtension, "0777");
                binContent = null; // Clear variable
            }

            const ngrokOptions = {addr: self.port, protocol:"http", region: "eu", inspect:false, binPath: () => self.AppConfiguration.cachePath};
            if (self.AppConfiguration.ngrokAuthToken) {
                ngrokOptions.authtoken = self.AppConfiguration.ngrokAuthToken;
            }

            ngrok.connect(ngrokOptions).then((url) => {
                // Auto restart tunnel every 6 hours (expiration)
                // New ngrok free account policy
                TimerWrapper.class.setTimeout((t) => {
                    Logger.info("Restart HTTP tunnel due to expiration policy");
                    t.stop();
                    t.start();
                }, 6 * 60 * 60 * 1000, this);

                self.ready(url);

                TimerWrapper.class.setTimeout((me, tunnelUrl) => { // Fix an issue where tunnel sent is null
                    me.ready(tunnelUrl);
                }, 5 * 1000, self, url);

            }).catch((err) => {
                Logger.err("Could not start HTTP tunnel : " + err.msg + " - " + err.error_code + " / " + err.status_code);
                Logger.err(err.message);

                TimerWrapper.class.setTimeout((me) => {
                    me.start();
                }, 30 * 1000, self);
            });
        }, 0, this);
    }

    /**
     * Stop tunnel
     */
    stop() {
        ngrok.disconnect();
        ngrok.kill();
        super.stop();
    }

}

module.exports = {class:TunnelNgrok};
