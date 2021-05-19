"use strict";
const PrivateProperties = require("./../PrivateProperties");
const FormConfiguration = require("../../formconfiguration/FormConfiguration");

/**
 * Public API for configuration
 *
 * @class
 */
class ConfigurationAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {ConfManager} confManager A configuration manager
    //  * @param  {FormManager} formManager A form manager
    //  * @param  {WebServices} webServices The web services instance
    //  * @param  {string} name        Plugin's name
    //  * @param  {string} category        Plugin's category
    //  * @param  {PluginAPI} plugin        Plugin API
    //  * @returns {ConfigurationAPI}             The instance
    //  */
    constructor(confManager, formManager, webServices, name, category, plugin) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).confManager = confManager;
        PrivateProperties.oprivate(this).formManager = formManager;
        PrivateProperties.oprivate(this).webServices = webServices;
        PrivateProperties.oprivate(this).name = name;
        PrivateProperties.oprivate(this).category = category;
        PrivateProperties.oprivate(this).formConfiguration = null;
        PrivateProperties.oprivate(this).plugin = plugin;
        this.form = null;

        PrivateProperties.oprivate(this).formConfiguration = new FormConfiguration.class(
            PrivateProperties.oprivate(this).confManager,
            PrivateProperties.oprivate(this).formManager,
            PrivateProperties.oprivate(this).webServices,
            PrivateProperties.oprivate(this).name
        );
    }
    /* eslint-enable */

    /**
     * Register a form
     *
     * @param  {Class} formClass A form annotation's implemented class
     * @param  {...object} inject    The injected objects
     */
    register(formClass, ...inject) {
        PrivateProperties.oprivate(this).formConfiguration.registerForm(formClass, ...inject);
        PrivateProperties.oprivate(this).plugin.exportClass(formClass);

        if (!this.form) {
            this.form = formClass;
        }
    }

    /**
     * Register a sub form
     *
     * @param  {Class} formClass A form annotation's implemented class
     * @param  {...object} inject    The injected objects
     */
    registerSubform(formClass, ...inject) {
        PrivateProperties.oprivate(this).formConfiguration.formManager.register(formClass, ...inject);
    }

    /**
     * Returns the configuration
     *
     * @returns {object} Configuration object
     */
    getConfiguration() {
        return PrivateProperties.oprivate(this).formConfiguration.getConfig();
    }

    /**
     * Return the formatted form object
     *
     * @returns {object} Formatted form object
     */
    getForm() {
        if (PrivateProperties.oprivate(this).formConfiguration) {
            return PrivateProperties.oprivate(this).formConfiguration.getForm();
        } else {
            return null;
        }
    }

    /**
     * Set the update callback. Called back when delete or save action is done.
     *
     * @param {Function} cb A callback with data as parameter, e.g. `(data, username) => {}`
     */
    setUpdateCb(cb) {
        return PrivateProperties.oprivate(this).formConfiguration.updateCb = cb;
    }

    // ConfManager part if needs to manage manually configurations

    /**
     * Load data manually from file (Array or object)
     *
     * @param  {class} classType The object class. This class MUST implement a json() method to process JSON to Object mapping
     * @param  {boolean} [disableClassMapping=false] Disable class mapping
     * @returns {Array|object}      An array of objects (instance of classType), or an object
     */
    loadData(classType, disableClassMapping = false) {
        if (PrivateProperties.oprivate(this).confManager.formConfiguration) {
            return PrivateProperties.oprivate(this).confManager.formConfiguration.loadData(classType, PrivateProperties.oprivate(this).name, disableClassMapping);
        } else {
            return PrivateProperties.oprivate(this).formConfiguration.confManager.loadData(classType, PrivateProperties.oprivate(this).name, disableClassMapping);
        }
    }

    /**
     * Save data manually for a specific key. Can throw error.
     *
     * @param  {object} data A JS object
     */
    saveData(data) {
        if (PrivateProperties.oprivate(this).confManager.formConfiguration) {
            PrivateProperties.oprivate(this).formConfiguration.saveConfig(data);
        } else {
            PrivateProperties.oprivate(this).formConfiguration.confManager.saveData(data, PrivateProperties.oprivate(this).name);
        }
    }

    /**
     * Returns the conf manager
     *
     * @returns {ConfManager}      The conf manager
     */
    getConfManager() {
        return PrivateProperties.oprivate(this).formConfiguration.confManager;
    }

    /**
     * Stop plugin stuff
     */
    stop() {
        return PrivateProperties.oprivate(this).formConfiguration.unregister();
    }

}

module.exports = {class:ConfigurationAPI};
