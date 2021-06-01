"use strict";

const Pushover = require("node-pushover");

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class is extended by user form
     *
     * @class
     */
    class PushOverForm extends api.exported.FormObject.class {
        /**
         * Push me user form
         *
         * @param  {number} id              An identifier
         * @param  {string} pushOverToken     A push over token
         * @returns {PushOverForm}                 The instance
         */
        constructor(id, pushOverToken) {
            super(id);

            /**
             * @Property("pushOverToken");
             * @Title("push.over.token");
             * @Type("string");
             */
            this.pushOverToken = pushOverToken;
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {PushOverForm}      An instance
         */
        json(data) {
            return new PushOverForm(data.id, data.pushOverToken);
        }
    }

    api.userAPI.addAdditionalFields(PushOverForm);

    /**
     * Push me plugin class
     *
     * @class
     */
    class PushOver extends api.exported.MessageProvider {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The API
         * @returns {PushOver}     The instance
         */
        constructor(api) {
            super(api);
            this.api = api;
        }

        /**
         * Send a message to all plugins.
         *
         * @param  {string|Array} [recipients="*"] The recipients. `*` for all users, otherwise an array of usernames - user `userAPI`, e.g. `["seb", "ema"]`
         * @param  {string} message          The notification message
         */
        sendMessage(recipients = "*", message) {
            this.api.userAPI.getUsers().forEach((user) => {
                if (recipients === "*" || (recipients instanceof Array && recipients.indexOf(user.username) !== -1)) {
                    try {
                        if (user.PushOverForm && user.PushOverForm.pushOverToken && user.PushOverForm.pushOverToken.length > 0) {
                            var push = new Pushover({
                                token: "a3qacsxrbknteevp8emdg96m9e1esy",
                                user: user.PushOverForm.pushOverToken
                            });
                            push.send("smarties.io", message);
                        }
                    } catch(e) {
                        api.exported.Logger.warn(e.message);
                    }
                }
            });
        }
    }

    api.instance = new PushOver(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "pushover",
    version: "0.0.0",
    category: "message-provider",
    description: "PushOver message sending",
    defaultDisabled: true,
    dependencies:["message-provider"]
};
