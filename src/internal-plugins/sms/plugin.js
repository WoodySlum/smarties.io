"use strict";

const fs = require("fs-extra");
const SerialPort = require("serialport");
const SMSServiceClass = require("./service.js");

const GAMMU_CONFIG_FOLDER = "gammu/";
const GAMMU_CONFIG_FILE = "gammu.rc";
const GAMMU_BASH_FILE = "receive.sh";
const GAMMU_CONFIG_FOLDER_INBOX = "spool/sms/inbox/";
const GAMMU_CONFIG_FOLDER_OUTBOX = "spool/sms/outbox/";
const GAMMU_CONFIG_FOLDER_SENT = "spool/sms/sent/";
const GAMMU_CONFIG_FOLDER_ERROR = "spool/sms/error/";
const ROUTE_RECEIVE = "sms/receive/";
const ROUTE_RECEIVE_POST = ":/" + ROUTE_RECEIVE;

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.installerAPI.register(["darwin-x32", "darwin-x64"], "brew install gammu", false, true, true);
    api.installerAPI.register(["linux-arm", "linux-arm64", "linux-x32", "linux-x64", "docker"], "apt-get install -y --allow-unauthenticated gammu gammu-smsd", true, true);
    api.init();

    /**
     * This class provides configuration form for SMS
     *
     * @class
     */
    class SMSForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} [id=null]                  An identifier
         * @param  {string} [port=null] The port identifier
         * @param  {boolean} [criticalOnly=false] Critical only message
         * @returns {SMSForm}                            The instance
         */
        constructor(id = null, port = null, criticalOnly = false) {
            super(id);

            /**
             * @Property("port");
             * @Type("string");
             * @Title("sms.port");
             * @Enum("getPorts");
             * @EnumNames("getPortsLabels");
             */
            this.port = port;

            /**
             * @Property("criticalOnly");
             * @Type("boolean");
             * @Title("sms.critical.only");
             * @Default(false);
             */
            this.criticalOnly = criticalOnly;
        }

        /**
         * Form injection method for ports
         *
         * @param  {...object} inject The modules list array
         * @returns {Array}        An array of ports
         */
        static getPorts(...inject) {
            return inject[0];
        }

        /**
         * Form injection method for ports labels
         *
         * @param  {...object} inject The modules list array
         * @returns {Array}        An array of ports labels
         */
        static getPortsLabels(...inject) {
            return inject[1];
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {SMSForm}      A form object
         */
        json(data) {
            return new SMSForm(data.id, data.port, data.criticalOnly);
        }
    }

    /**
     * This class is extended by user form
     *
     * @class
     */
    class SMSUserForm extends api.exported.FormObject.class {
        /**
         * Prowl user form
         *
         * @param  {number} id              An identifier
         * @param  {string} phoneNumber     A phone number
         * @returns {SMSUserForm}                 The instance
         */
        constructor(id, phoneNumber) {
            super(id);

            /**
             * @Property("phoneNumber");
             * @Title("sms.user.phone");
             * @Type("string");
             */
            this.phoneNumber = phoneNumber;
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {SMSUserForm}      An instance
         */
        json(data) {
            return new SMSUserForm(data.id, data.phoneNumber);
        }
    }

    api.userAPI.addAdditionalFields(SMSUserForm);

    /**
     * Prowl plugin class
     *
     * @class
     */
    class SMS extends api.exported.MessageProvider {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The API
         * @returns {SMS}     The instance
         */
        constructor(api) {
            super(api);
            this.api = api;
            this.service = null;
            this.gammuConfigFile = null;
            this.init();

            this.api.webAPI.register(this, this.api.webAPI.constants().POST, ROUTE_RECEIVE_POST, this.api.webAPI.Authentication().AUTH_LOCAL_NETWORK_LEVEL);

            this.api.configurationAPI.setUpdateCb(() => {
                this.init();
            });

            if (!process.env.TEST) {
                /*const usbDetect = require("usb-detection");
                usbDetect.startMonitoring();
                usbDetect.on("change", () => {
                    api.exported.TimerWrapper.class.setTimeout((self) => {
                        self.init();
                    }, 2000, this);
                });*/
            }

        }

        /**
         * Init configuration and other stuff
         */
        init() {
            this.api.exported.Logger.info("Initializing SMS module");
            // Check serial ports
            this.getAvailableDevices((results) => {
                const ports = [];
                const portsLabels = [];
                results.forEach((result) => {
                    ports.push(result.port);
                    portsLabels.push(result.name);
                });

                this.api.configurationAPI.register(SMSForm, ports, portsLabels);
            });

            const configuration = this.api.configurationAPI.getConfiguration();
            if (configuration && configuration.port) {
                // Write file config
                this.gammuConfigFile = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_CONFIG_FILE;
                const shellReceiveScriptFile  = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_BASH_FILE;
                const inbox = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_CONFIG_FOLDER_INBOX;
                const outbox = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_CONFIG_FOLDER_OUTBOX;
                const sent = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_CONFIG_FOLDER_SENT;
                const error = api.exported.cachePath + GAMMU_CONFIG_FOLDER + GAMMU_CONFIG_FOLDER_ERROR;

                fs.ensureDirSync(inbox);
                fs.ensureDirSync(outbox);
                fs.ensureDirSync(sent);
                fs.ensureDirSync(error);
                fs.writeFileSync(this.gammuConfigFile, this.generateGammuConfig(configuration.port, inbox, outbox, sent, error, shellReceiveScriptFile));
                fs.writeFileSync(shellReceiveScriptFile, this.generateGammuReceiveSh(this.api.environmentAPI.getLocalAPIUrl(), inbox));
                fs.chmodSync(shellReceiveScriptFile, "755");

                if (!this.service) {
                    const SMSService = SMSServiceClass(api);
                    this.service = new SMSService(this, this.gammuConfigFile);
                    api.servicesManagerAPI.add(this.service);
                } else {
                    this.service.restart();
                }
            } else {
                if (this.service) {
                    this.service.stop();
                }
            }
        }

        /**
         * Get available devices
         *
         * @param  {Function} cb A callback with the list of devices `(devices) => {}`
         */
        getAvailableDevices(cb) {
            SerialPort.list().then(ports => {
                const results = [];
                ports.forEach(function(port) {
                    results.push({
                        port: port.path,
                        name: port.pnpId + " (" + port.path + ")"
                    });
                });
                cb(results);
            }).catch((e) => {
                api.exported.Logger.err(e.message);
            });
        }

        /**
         * Generates the Gammu configuration file
         *
         * @param  {string} port   The port
         * @param  {string} inbox  The inbox path
         * @param  {string} outbox The outbox path
         * @param  {string} sent   The sent path
         * @param  {string} error  The error path
         * @param  {string} shellReceiveScript  The shell receive script
         * @returns {string}        The configuration path
         */
        generateGammuConfig(port, inbox, outbox, sent, error, shellReceiveScript) {
            const gammuConfig = `[gammu]
port = ` + port + `
connection = at
debuglevel = 0
logfile =
service = FILES
inboxpath = `+ inbox + `
outboxpath = `+ outbox + `
sentsmspath = ` + sent + `
errorsmspath = ` + error + `
runonreceive = ` + shellReceiveScript + `

[smsd]
port = ` + port + `
connection = at
debuglevel = 0
logfile =
service = FILES
inboxpath = `+ inbox + `
outboxpath = `+ outbox + `
sentsmspath = ` + sent + `
errorsmspath = ` + error + `
runonreceive = ` + shellReceiveScript + `
`;

            return gammuConfig;
        }

        /**
         * Generates the content of the receive script
         *
         * @param  {string} url The url
         * @param  {string} inbox The inbox folder
         * @returns {string}     the shell content
         */
        generateGammuReceiveSh(url, inbox) {
            const shellScript = `#!/bin/sh
FILE=$1
MESSAGE=$SMS_1_TEXT
FROM=$SMS_1_NUMBER
INPUT="` + inbox + `"
curl -H "Content-Type: application/json" -X POST -k -L --data "{\\"data\\":{\\"from\\":\\"$FROM\\", \\"message\\":\\"$MESSAGE\\"}}" ` + url + ROUTE_RECEIVE + `
`;

            return shellScript;
        }

        /**
         * Send a SMS message
         *
         * @param  {string} number  The pgone number
         * @param  {string} message the message
         */
        sendSMS(number, message) {
            if (this.gammuConfigFile) {
                this.api.installerAPI.executeCommand("gammu-smsd-inject -c " + this.gammuConfigFile + " TEXT " + number + " -text \"" + message + "\"" , false, (error, stdout, stderr) => {
                    if (error) {
                        this.api.exported.Logger.err(error.message);
                        this.api.exported.Logger.err(stderr);
                    }
                });
            }
        }

        /**
         * Send a message to all plugins.
         *
         * @param  {string|Array} [recipients="*"] The recipients. `*` for all users, otherwise an array of usernames - user `userAPI`, e.g. `["seb", "ema"]`
         * @param  {string} message          The notification message
         * @param  {string} [action=null]    The action
         * @param  {string} [link=null]      The link
         * @param  {string} [picture=null]   The picture
         * @param  {boolean} [critical=false]   Critical message
         */
        sendMessage(recipients = "*", message, action = null, link = null, picture = null, critical = false) {
            action; // Lint
            link; // Lint
            picture; // Lint
            let criticalOnly = false;
            if (this.api.configurationAPI.getConfiguration()) {
                criticalOnly = !!this.api.configurationAPI.getConfiguration().criticalOnly;
            }
            this.api.userAPI.getUsers().forEach((user) => {
                if (message && (recipients === "*" || (recipients instanceof Array && recipients.indexOf(user.username) !== -1))) {
                    if (this.gammuConfigFile && user.SMSUserForm && user.SMSUserForm.phoneNumber && user.SMSUserForm.phoneNumber.length > 0 && (!criticalOnly || (critical && criticalOnly))) {
                        this.sendSMS(user.SMSUserForm.phoneNumber.split(" ").join(""), message);
                    }
                }
            });
        }

        /**
         * Process API callback
         *
         * @param  {APIRequest} apiRequest An APIRequest
         * @returns {Promise}  A promise with an APIResponse object
         */
        processAPI(apiRequest) {
            if (apiRequest.route === ROUTE_RECEIVE_POST) {
                return new Promise((resolve) => {
                    if (apiRequest.data.from && apiRequest.data.message && apiRequest.data.from.length > 6) {
                        const fromNumberRaw = apiRequest.data.from.split(" ").join("");
                        const fromNumber = parseInt(fromNumberRaw.substr(fromNumberRaw.length - 6));
                        this.api.userAPI.getUsers().forEach((user) => {
                            if (user.SMSUserForm && user.SMSUserForm.phoneNumber && user.SMSUserForm.phoneNumber.length > 5) {
                                const userNumberRaw = user.SMSUserForm.phoneNumber.split(" ").join("");
                                const userNumber = parseInt(userNumberRaw.substr(userNumberRaw.length - 6));

                                if (userNumber === fromNumber) {
                                    this.onMessageReceived(user.username, apiRequest.data.message);
                                }
                            }
                        });

                        resolve(this.api.webAPI.APIResponse(true, {success:true}));
                    } else {
                        this.api.exported.Logger.err("Invalid SMS received : " + JSON.stringify(apiRequest.data));
                        resolve(this.api.webAPI.APIResponse(true, {success:false, message:"Invalid parameters, phone number smaller than 6 characters"}));
                    }

                });
            }
        }
    }

    api.instance = new SMS(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "sms",
    version: "0.0.0",
    category: "message-provider",
    description: "SMS message provider",
    defaultDisabled: true,
    dependencies:["message-provider"]
};
