"use strict";

const TuyAPI = require("tuyapi");

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
    * This class is used for tuya form
    *
    * @class
    */
    class TuyaForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param  {string} tuya       Enable or disable
         * @param  {string} tuyaId      Identifier
         * @param  {string} tuyaKey           Key
         * @param  {string} tuyaParentId    Parent id
         * @param  {object} tuyaCid           Tuya cid
         * @param  {string} tuyaIp          IP address
         * @returns {TuyaForm}              The instance
         */
        constructor(id, tuya, tuyaId, tuyaKey, tuyaParentId, tuyaCid, tuyaIp) {
            super(id);

            /**
             * @Property("tuya");
             * @Title("tuya.enable");
             * @Type("string");
             * @Default("none");
             * @Enum(["none", "on"]);
             * @EnumNames(["tuya.none", "tuya.on"]);
             */
            this.tuya = tuya;

            /**
             * @Property("tuyaId");
             * @Title("tuya.id");
             * @Type("string");
             */
            this.tuyaId = tuyaId;

            /**
             * @Property("tuyaKey");
             * @Title("tuya.key");
             * @Type("string");
             */
            this.tuyaKey = tuyaKey;

            /**
             * @Property("tuyaParentId");
             * @Title("tuya.id.parent");
             * @Type("string");
             */
            this.tuyaParentId = tuyaParentId;

            /**
             * @Property("tuyaCid");
             * @Title("tuya.cid");
             * @Type("string");
             */
            this.tuyaCid = tuyaCid;

            /**
             * @Property("tuyaIp");
             * @Type("object");
             * @Cl("IpScanForm");
             */
            this.tuyaIp = tuyaIp;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {TuyaForm}      A form object
         */
        json(data) {
            return new TuyaForm(data.id, data.tuya, data.tuyaId, data.tuyaKey, data.tuyaParentKey, data.tuyaCid, data.tuyaIp);
        }
    }

    api.configurationAPI.registerSubform(TuyaForm);

    /**
     * This class manage Tuya
     *
     * @class
     */
    class Tuya {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The core APIs
         * @returns {Tuya}        The instance
         */
        constructor(api) {
            this.api = api;
        }

        /**
         * Get device
         *
         * @param  {object} configuration The configuration
         * @returns {object}        The TuyaAPI device object
         */
        getDevice(configuration) {
            let ret = null;
            if (configuration && configuration.tuyaId && configuration.tuyaKey && configuration.tuyaIp) {
                ret = new TuyAPI({
                    gwID: (configuration.tuyaParentId && configuration.tuyaParentId.length > 0 ? configuration.tuyaParentId : null),
                    id: configuration.tuyaId,
                    key: configuration.tuyaKey,
                    ip: (configuration.tuyaIp.ip == "freetext" ? configuration.tuyaIp.freetext : configuration.tuyaIp.ip),
                    version: 3.3,
                    persistentConnection: false
                });
            } else {
                api.exported.Logger.err("Missing parameters");
            }
            return ret;
        }

        /**
         * Connect and send
         *
         * @param  {object} device The result of getDevice
         * @param  {object} configuration The configuration
         * @param  {object} payload The payload
         * @param  {Function} [cb=null] The callback
         */
        connectAndSend(device, configuration, payload, cb = null) {
            device.on("error", (e) => {
                api.exported.Logger.err(payload);
                api.exported.Logger.err(e);
                if (cb) cb(e);
            });
            device.find().then(() => {
                device.on("connected", () => {
                    api.exported.Logger.verbose("Connected");
                    const message = { multiple: true, data: payload };
                    if (configuration.tuyaCid && configuration.tuyaCid.length > 0) {
                        message.cid = configuration.tuyaCid;
                    }

                    device.set(message).then(() => {
                        if (cb) cb(null);
                        device.disconnect();
                    })
                        .catch((e) => {
                            api.exported.Logger.err(payload);
                            api.exported.Logger.err(e);
                            if (cb) cb(e);
                            device.disconnect();
                        });
                });
                device.on("disconnected", () => {
                    api.exported.Logger.verbose("Disconnected");
                });
                device.connect().then(() => {
                    
                })
                    .catch((e) => {
                        api.exported.Logger.err(payload);
                        api.exported.Logger.err(e);
                        if (cb) cb(e);
                    });
                
            })
                .catch((e) => {
                    api.exported.Logger.err(payload);
                    api.exported.Logger.err(e);
                    if (cb) cb(e);
                });
        }

        /**
         * Get status
         *
         * @param  {object} device The result of getDevice
         * @param  {object} configuration The configuration
         * @param  {Function} [cb=null] The callback
         */
        connectAndGet(device, configuration, cb = null) {
            device.on("error", (e) => {
                api.exported.Logger.err(e);
                if (cb) cb(e);
            });
            device.find().then(() => {
                device.on("data", data => {
                    if (cb) cb(null, data);
                    device.disconnect(); 
                });
                device.on("connected", () => {
                    api.exported.Logger.verbose("Connected");
                    const message = {schema: true};
                    if (configuration.tuyaCid && configuration.tuyaCid.length > 0) {
                        message.cid = configuration.tuyaCid;
                    }

                    device.get(message).then(() => {

                    })
                        .catch((e) => {
                            api.exported.Logger.err(e);
                            if (cb) cb(e);
                            device.disconnect();
                        });
                });
                device.on("disconnected", () => {
                    api.exported.Logger.verbose("Disconnected");
                });
                device.connect().then(() => {
                    
                })
                    .catch((e) => {
                        api.exported.Logger.err(e);
                        if (cb) cb(e);
                    });
                
            })
                .catch((e) => {
                    api.exported.Logger.err(e);
                    if (cb) cb(e);
                });
        }
    }

        

    api.registerInstance(new Tuya(api));

}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "tuya",
    version: "0.0.1",
    category: "misc",
    description: "Tuya base plugin",
    defaultDisabled: true
};
