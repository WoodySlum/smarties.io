"use strict";

const Logger = require("./../../../logger/Logger");
const GatewayManager = require("./../../../modules/gatewaymanager/GatewayManager");

/**
 * This class wraps tunnel apis
 *
 * @class
 */
class Tunnel {

    /**
     * Constructor
     *
     * @param  {int} port       The web services port
     * @param  {GatewayManager} gatewayManager       The gateway manager
     * @param  {EnvironmentManager} environmentManager       The environment manager
     * @param  {object}   AppConfiguration     The app configuration
     * @param  {Function}   cbTunnelDone     Callback when tunnel is created
     *
     * @returns {Tunnel}            The instance
     */
    constructor(port, gatewayManager, environmentManager, AppConfiguration, cbTunnelDone) {
        this.port = port;
        this.gatewayManager = gatewayManager;
        this.environmentManager = environmentManager;
        this.AppConfiguration = AppConfiguration;
        this.subdomain = "smartiesio-" + this.environmentManager.getSmartiesId();
        this.cbTunnelDone = cbTunnelDone;
    }

    /**
     * Start tunnel
     */
    start() {
        this.gatewayManager.bootMode = GatewayManager.BOOT_MODE_BOOTING;
        this.gatewayManager.tunnelUrl = null;
        this.gatewayManager.transmit();
    }

    /**
     * Stop tunnel
     */
    stop() {
        this.gatewayManager.bootMode = GatewayManager.BOOT_MODE_STOP;
        this.gatewayManager.tunnelUrl = null;
        this.gatewayManager.transmit();
    }

    /**
     * Set when ready
     *
     * @param  {string} url       The tunnel url
     */
    ready(url) {
        Logger.info("HTTP tunnel URL : " + url);
        this.gatewayManager.bootMode = GatewayManager.BOOT_MODE_READY;
        this.gatewayManager.tunnelUrl = url;
        this.gatewayManager.transmit();
        if (this.cbTunnelDone) {
            this.cbTunnelDone(this.gatewayManager.tunnelUrl);
        }
    }
}

module.exports = {class:Tunnel};
