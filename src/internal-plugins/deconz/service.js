"use strict";

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    /**
     * This class conect to RFLink using serial port on a pseicif thread.
     *
     * @class
     */
    class DeconzService extends api.exported.Service.class {
        /**
         * Constructor
         *
         * @param  {Deconz} plugin The Deconz plugin
         * @param  {number} port The deconz running port
         * @returns {DeconzService}        The instance
         */
        constructor(plugin, port) {
            try {
                api.installerAPI.executeCommand("mkdir -p /root/.local && rm -f /.local && ln -s /root/.local /"); // Link to /root dir for backup
            } catch(e) {
                api.exported.Logger.err(e);
            }

            super("deconz", null, api.exported.Service.SERVICE_MODE_EXTERNAL, "deCONZ -platform minimal --http-port=" + port);
        }
    }

    return DeconzService;
}

module.exports = loaded;
