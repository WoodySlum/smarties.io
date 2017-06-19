"use strict";

const PrivateProperties = require("./PrivateProperties");
var WebAPI = require("./publicapis/WebAPI");
var ServicesManagerAPI = require("./publicapis/ServicesManagerAPI");
var DatabaseAPI = require("./publicapis/DatabaseAPI");
var Service = require("./../../services/Service");
var DbObject = require("./../dbmanager/DbObject");
var Logger = require("./../../logger/Logger");

/**
 * This class is an interface for plugins
 * @class
 */
class PluginsAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  * @param  {string} previousVersion The plugin's previous version, used for migration
    //  * @param  {object} p The plugin require value
    //  * @param  {WebServices} webServices     The web services
    //  * @param  {ServicesManager} servicesManager     The services manager
    //  * @param  {DbManager} webServices     The database manager
    //  * @returns {PluginAPI}                  Insntance
    //  */
    constructor(previousVersion, p, webServices, servicesManager, dbManager) {
        PrivateProperties.createPrivateState(this);
        this.previousVersion = previousVersion;
        this.p = p;

        PrivateProperties.oprivate(this).loadedCallback = this.p.attributes.loadedCallback;
        this.identifier = this.p.attributes.name;
        this.category = this.p.attributes.category;
        this.version = this.p.attributes.version;
        this.description = this.p.attributes.description;
        this.classes = Array.isArray(this.p.attributes.classes)?this.p.attributes.classes.slice():[];
        this.dependencies = (Array.isArray(this.p.attributes.dependencies))?this.p.attributes.dependencies.slice():[];
        this.exported = {};

        // Export classes
        this.exported = Object.assign(this.exported,
            {Service: Service},
            {DbObject: DbObject}
        );

        // Sub APIs
        this.webAPI = new WebAPI.class(webServices);
        this.servicesManagerAPI = new ServicesManagerAPI.class(servicesManager);
        this.databaseAPI = new DatabaseAPI.class(dbManager, this.previousVersion);
    }

    // /**
    //  * Loaded method
    //  */
    loaded() {
        PrivateProperties.oprivate(this).loadedCallback(this);
        Logger.info("Plugin " + this.identifier + " loaded");
    }

    // /**
    //  * Export a object with key / value containing exported classes
    //  *
    //  * @param  {Object} classes An array of classes
    //  */
    exportClasses(classes) {
        if (classes) {
            this.exported = Object.assign(classes, this.exported);
        }
    }

    /* eslint-enable */

    // Public APIs

    /**
     * Expose a class to other plugins
     *
     * @param  {class} c A class
     */
    exportClass(c) {
        this.exported[c.name] = c;
    }
}

module.exports = {class:PluginsAPI};
