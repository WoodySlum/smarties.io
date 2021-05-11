"use strict";

const Logger = require("./../../../logger/Logger");
const fs = require("fs-extra");
const Tunnel = require("./Tunnel");
const LocalXpose = require("localxpose");

/**
 * This class wraps local tunnel apis
 *
 * @class
 */
class TunnelLocalxpose extends Tunnel.class {

    /**
     * Constructor
     *
     * @param  {int} port       The web services port
     * @param  {GatewayManager} gatewayManager       The gateway manager
     * @param  {EnvironmentManager} environmentManager       The environment manager
     * @param  {object}   AppConfiguration     The app configuration
     *
     * @returns {TunnelLocalxpose}            The instance
     */
    constructor(port, gatewayManager, environmentManager, AppConfiguration) {
        super(port, gatewayManager, environmentManager, AppConfiguration);
        this.tunnel = null;
        if (!this.AppConfiguration.localxposeAccessToken) {
            throw Error("Add 'localxposeAccessToken' to config.json file to use LocalXpose tunnel. Go to https://localxpose.io/");
        }

        const platform = require("os").platform();
        const binExtension = "lxrpc" + (platform === "win32" ? ".exe" : "");
        this.lxrpcBin = AppConfiguration.cachePath + binExtension;

        if (!fs.existsSync(this.lxrpcBin)) {
            Logger.info("Copy lxrpc bin");
            var binContent = fs.readFileSync(__dirname + "/../../../../node_modules/localxpose/bin/" + binExtension);
            fs.writeFileSync(this.lxrpcBin, binContent);
            fs.chmodSync(AppConfiguration.cachePath + binExtension, "0777");
            binContent = null; // Clear variable
        }

        this.client = null;
        this.tunnel = null;
    }

    /**
     * Start tunnel
     */
    start() {
        super.start();
        this.client = new LocalXpose(this.AppConfiguration.localxposeAccessToken, this.lxrpcBin);
        this.client.http({
            region: this.AppConfiguration.localxposeRegion ? this.AppConfiguration.localxposeRegion : "eu", // us, ap or eu (default: us)
            to: "127.0.0.1:" + this.port, // address to forward to (default: 127.0.0.1:8080)
            subdomain: this.subdomain, // tunnel subdomain (default: random)
        })
            .then((tunnel) => {
                this.tunnel = tunnel;
                if (tunnel.addr) {
                    this.ready("https://" + tunnel.addr);
                }
                if (!this.AppConfiguration.localxposePaid) {
                    // If not paid, restart every 15 min
                    setTimeout((self) => {
                        self.stop();
                        self.start();
                    }, 15 * 60 * 1000, this);
                }
            })
            .catch((err) => {
                Logger.err(err);
                if (err) {
                    setTimeout((self) => {
                        self.stop();
                        self.start();
                    }, 5 * 1000, this);
                }
            });
    }

    /**
     * Stop tunnel
     */
    stop() {
        if (this.tunnel) {
            this.client.kill();
            this.tunnel = null;
            this.client = null;
        }
        super.stop();
    }

}

module.exports = {class:TunnelLocalxpose};
