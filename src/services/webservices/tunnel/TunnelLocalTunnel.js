"use strict";

const Logger = require("./../../../logger/Logger");
const TimerWrapper = require("./../../../utils/TimerWrapper");
const Tunnel = require("./Tunnel");
const localtunnel = require("localtunnel");
const RESTART_TIMER_MIN = 60;

/**
 * This class wraps local tunnel apis
 *
 * @class
 */
class TunnelLocalTunnel extends Tunnel.class {

    /**
     * Constructor
     *
     * @param  {int} port       The web services port
     * @param  {GatewayManager} gatewayManager       The gateway manager
     * @param  {EnvironmentManager} environmentManager       The environment manager
     * @param  {object}   AppConfiguration     The app configuration
     * @param  {Function}   cbTunnelDone     Callback when tunnel is created
     *
     * @returns {TunnelLocalTunnel}            The instance
     */
    constructor(port, gatewayManager, environmentManager, AppConfiguration, cbTunnelDone) {
        super(port, gatewayManager, environmentManager, AppConfiguration, cbTunnelDone);
        this.tunnel = null;
        this.isRunning = false;
    }

    /**
     * Start tunnel
     */
    start() {
        super.start();
        localtunnel({port: this.port, allow_invalid_cert: true, local_https:true, subdomain: this.subdomain }).then((tunnel) => {
            this.tunnel = tunnel;
            this.isRunning = true;
            this.ready(this.tunnel.url);
            this.tunnel.on("close", () => {
                if (this.isRunning) {
                    Logger.warn("Closed tunnel, restart...");
                    this.stop();
                    TimerWrapper.class.setTimeout((self) => {
                        self.start();
                    }, 30 * 1000, this);
                }
            });

            this.tunnel.on("error", (err) => {
                Logger.err(err);
                if (this.isRunning) {
                    Logger.warn("Error tunnel, restart...");
                    this.stop();
                    TimerWrapper.class.setTimeout((self) => {
                        self.start();
                    }, 30 * 1000, this);
                }
            });

            TimerWrapper.class.setTimeout((self) => {
                self.stop();
                self.start();
            }, RESTART_TIMER_MIN * 60 * 1000, this);
        })
            .catch((e) => {
                Logger.err(e);
                this.stop();
                TimerWrapper.class.setTimeout((self) => {
                    self.start();
                }, 30 * 1000, this);
            });
    }

    /**
     * Stop tunnel
     */
    stop() {
        if (this.tunnel) {
            this.isRunning = false;
            this.tunnel.close();
            this.tunnel = null;
        }

        super.stop();
    }

}

module.exports = {class:TunnelLocalTunnel};
