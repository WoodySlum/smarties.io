"use strict";

const sha256 = require("sha256");
const routerBridge = require("dialog-router-api");
const fs = require("fs-extra");
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
    * This class is used for Huawei Router form
     *
    * @class
    */
    class HuaweiRouterForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} ip       The ip address
         * @param  {string} username The username
         * @param  {string} password The password
         * @param  {boolean} technoTile The technology tile
         * @returns {HuaweiRouterForm}              The instance
         */
        constructor(id, ip, username, password, technoTile) {
            super(id);

            /**
             * @Property("ip");
             * @Type("string");
             * @Title("huawei.router.ip");
             * @Regexp("[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}");
             */
            this.ip = ip;

            /**
             * @Property("username");
             * @Type("string");
             * @Title("huawei.router.username");
             */
            this.username = username;

            /**
             * @Property("password");
             * @Type("string");
             * @Title("huawei.router.password");
             * @Display("password");
             */
            this.password = password;

            /**
             * @Property("technoTile");
             * @Type("boolean");
             * @Title("huawei.router.techno.tile");
             */
            this.technoTile = technoTile;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {HuaweiRouterForm}      A form object
         */
        json(data) {
            return new HuaweiRouterForm(data.id, data.ip, data.username, data.password, data.technoTile);
        }
    }

    api.configurationAPI.register(HuaweiRouterForm);

    /**
    * This class is used for Huawei Router form
     *
    * @class
    */
    class HuaweiRouterScenarioForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {boolean} reboot       Reboot router
         * @returns {HuaweiRouterScenarioForm}              The instance
         */
        constructor(id, reboot = false) {
            super(id);

            /**
             * @Property("reboot");
             * @Type("boolean");
             * @Default(false);
             * @Title("huawei.router.scenario.reboot");
             */
            this.reboot = reboot;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {HuaweiRouterScenarioForm}      A form object
         */
        json(data) {
            return new HuaweiRouterScenarioForm(data.id, data.reboot);
        }
    }

    /**
     * This class manage huawei routers
     *
     * @class
     */
    class HuaweiRouter {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {HuaweiRouter}     The instance
         */
        constructor(api) {
            this.api = api;
            this.apiInfos = {};
            this.registeredElements = {};
            this.receivedSms = [];

            this.getApiInformations();

            const self = this;
            this.api.configurationAPI.setUpdateCb(() => {
                self.getApiInformations();
            });

            // Save box api call every hour and dispatch
            this.api.timeEventAPI.register((self) => {
                const d = new Date();
                const m = d.getMinutes();
                if ((m % 17) === 0) { // 17 for dispatching more randomly
                    self.getApiInformations();
                }

                if ((m % 5) === 0) { // Chezck every 5 minutes
                    api.exported.TimerWrapper.class.setTimeout(() => {
                        self.getSMS();
                    }, 100);
                }
            }, this, this.api.timeEventAPI.constants().EVERY_MINUTES);

            this.api.scenarioAPI.register(HuaweiRouterScenarioForm, (scenario) => {
                if (scenario && scenario.HuaweiRouterScenarioForm && scenario.HuaweiRouterScenarioForm.reboot) {
                    this.reboot();
                }
            }, this.api.translateAPI.t("huawei.router.scenario.title"));

        }

        /**
         * Register for router informations
         *
         * @param  {Function} cb            A callback triggered when weather information is received. Example : `(error, weatherDbObject) => {}`
         * @param  {string} id            An identifier
         */
        register(cb, id = null) {
            const index = sha256(cb.toString() + id);
            this.registeredElements[index] = cb;
        }

        /**
         * Unregister router informations
         *
         * @param  {Function} cb             A callback triggered when weather information is received. Example : `(error, weatherDbObject) => {}`
         * @param  {string} id            An identifier
         */
        unregister(cb, id = null) {
            const index = sha256(cb.toString() + id);
            if (this.registeredElements[index]) {
                delete this.registeredElements[index];
            } else {
                api.exported.Logger.warn("Element not found");
            }
        }

        /**
         * Retrieve API informaitons and set to cache
         */
        getApiInformations() {
            const conf = this.api.configurationAPI.getConfiguration();
            const self = this;
            if (conf && conf.ip && conf.username && conf.password) {
                api.exported.Logger.info("Retrieving router infos");
                const router = routerBridge.create({
                    gateway: conf.ip
                });

                try {
                    router.getToken((error, token) => {
                        if (error) {
                            self.api.exported.Logger.err(error.message);
                        } else {
                            router.login(token, conf.username, conf.password, () => {
                                router.getMonthStatistics(token, function(monthlyStatsError, monthlyStatsResponse){
                                    if (monthlyStatsError) {
                                        self.api.exported.Logger.err(monthlyStatsError.message);
                                    }
                                    router.getSignal(token, function(signalStatsError, signalStatsResponse){
                                        if (signalStatsError) {
                                            self.api.exported.Logger.err(signalStatsError.message);
                                        }

                                        router.getStatus(token, function(statusStatsError, statusStatsResponse){
                                            if (statusStatsError) {
                                                self.api.exported.Logger.err(statusStatsError.message);
                                            }

                                            try {
                                                api.exported.Logger.info("Retrieved router informations");
                                                self.apiInfos = {
                                                    dataUsage: monthlyStatsResponse,
                                                    signal: signalStatsResponse,
                                                    status: statusStatsResponse
                                                };
                                                Object.keys(self.registeredElements).forEach((registeredKey) => {
                                                    self.registeredElements[registeredKey](self.apiInfos);
                                                });

                                                // Show tile
                                                if (self.apiInfos.signal && self.apiInfos.signal.mode[0] && self.apiInfos.signal.rssi[0]) {
                                                    let networkType = "-";
                                                    if (parseInt(self.apiInfos.signal.mode[0]) >= 3) {
                                                        if (parseInt(self.apiInfos.status.CurrentNetworkTypeEx) === 1011) {
                                                            networkType = "4G+";
                                                        } else {
                                                            networkType = "4G";
                                                        }
                                                    } else if (parseInt(self.apiInfos.signal.mode[0]) === 2) {
                                                        networkType = "3G";
                                                    } else if (parseInt(self.apiInfos.signal.mode[0]) === 1) {
                                                        networkType = "2G";
                                                    }

                                                    const rssi = parseInt(self.apiInfos.signal.rssi[0].replace("dBm", "").replace(">=", "").replace("<=", "").replace(">", "").replace("<", ""));
                                                    //-51 : Good signal
                                                    //-113 : Poor signal

                                                    let rssiIndicator = parseInt(100 - ((rssi - (-51)) * 100 / (-113 - -51)));
                                                    if (rssiIndicator < 0) {
                                                        rssiIndicator = 0;
                                                    } else if (rssiIndicator > 100) {
                                                        rssiIndicator = 100;
                                                    }

                                                    if (conf.technoTile) {
                                                        const background = fs.readFileSync("./res/tiles/router4g.jpg").toString("base64");
                                                        const tile = api.dashboardAPI.Tile("huawei-router-network", api.dashboardAPI.TileType().TILE_INFO_TWO_TEXT, api.exported.Icons.icons["router"], null, api.translateAPI.t("huawei.router.router.title"), networkType + " [" + rssiIndicator + "%]", background);
                                                        api.dashboardAPI.registerTile(tile);
                                                    } else {
                                                        api.dashboardAPI.unregisterTile("huawei-router-network");
                                                    }
                                                }
                                            } catch(e) {
                                                api.exported.Logger.err(e.message);
                                            }

                                        });
                                    });
                                });
                            });
                        }
                    });
                } catch(e) {
                    self.api.exported.Logger.err(e.message);
                }

            }
        }

        /**
         * Reboot box
         */
        reboot() {
            const conf = this.api.configurationAPI.getConfiguration();
            const self = this;
            if (conf && conf.ip && conf.username && conf.password) {
                api.exported.Logger.info("Rebooting router SMS");
                const router = routerBridge.create({
                    gateway: conf.ip
                });

                try {
                    router.getToken((error, token) => {
                        if (error) {
                            self.api.exported.Logger.err(error.message);
                        } else {
                            router.login(token, conf.username, conf.password, () => {
                                router.reboot(token, (err) => {
                                    if (err) {
                                        self.api.exported.Logger.warn(err.message);
                                    } else  {
                                        self.api.exported.Logger.warn("Router rebooted !");
                                    }
                                });
                            });
                        }
                    });
                } catch(e) {
                    api.exported.Logger.err(e.message);
                }
            }
        }

        /**
         * Retrieve SMS
         */
        getSMS() {
            const conf = this.api.configurationAPI.getConfiguration();
            const self = this;
            if (conf && conf.ip && conf.username && conf.password) {
                api.exported.Logger.info("Retrieving router SMS");
                const router = routerBridge.create({
                    gateway: conf.ip
                });

                try {
                    router.getToken((error, token) => {
                        if (error) {
                            self.api.exported.Logger.err(error.message);
                        } else {
                            router.login(token, conf.username, conf.password, () => {
                                router.getAllSms(token, true, (err, messages) => {
                                    if (err) {
                                        self.api.exported.Logger.warn(err);
                                    } else if (messages.length > 0) {
                                        messages.forEach((message) => {
                                            if (self.receivedSms.indexOf(message.Date + "-" + message.Phone) === -1)  {
                                                self.receivedSms.push(message.Date + "-" + message.Phone);
                                                self.api.coreAPI.dispatchEvent("huawei-sms-event", {phoneNumber:message.Phone, date:message.Date, message:message.Content});
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    });
                } catch(e) {
                    api.exported.Logger.err(e.message);
                }
            }
        }

        /**
         * Send a SMS message
         *
         * @param  {string} number  The pgone number
         * @param  {string} message the message
         */
        sendSMS(number, message) {
            const conf = this.api.configurationAPI.getConfiguration();
            const self = this;
            if (conf && conf.ip && conf.username && conf.password) {
                api.exported.Logger.info("Sending sms through router");
                const router = routerBridge.create({
                    gateway: conf.ip
                });

                try {
                    router.getToken((error, token) => {
                        if (error) {
                            self.api.exported.Logger.err(error.message);
                        } else {
                            router.login(token, conf.username, conf.password, () => {
                                router.sendSms(token, number, message.split("'").join("’"), (err) => {
                                    if (err) {
                                        self.api.exported.Logger.err(err.message);
                                    }
                                });
                            });
                        }
                    });
                } catch(e) {
                    api.exported.Logger.err(e.message);
                }
            }
        }
    }

    //api.exportClass(HuaweiRouter);
    api.registerInstance(new HuaweiRouter(api));
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "huawei-router",
    version: "0.0.0",
    category: "misc",
    defaultDisabled: true,
    description: "Huawei 3G/4G router"
};
