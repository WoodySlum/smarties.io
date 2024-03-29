"use strict";
const PrivateProperties = require("./../PrivateProperties");

/**
 * Public API for scenarios
 *
 * @class
 */
class ScenarioAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {ScenarioManager} scenarioManager The scenario manager
    //  * @returns {ScenarioAPI}             The instance
    //  */
    constructor(scenarioManager) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).scenarioManager = scenarioManager;
    }
    /* eslint-enable */

    /**
     * Register a subform class for using into another form
     *
     * @param  {Class} formPart     A class with form annotations
     * @param  {...object} inject Parameters injection on static methods
     */
    registerSubform(formPart, ...inject) {
        PrivateProperties.oprivate(this).scenarioManager.formManager.register(formPart, ...inject);
    }

    /**
     * Register to scenario execution engine
     *
     * @param  {FormObject} formPart         A form part
     * @param  {Function} [triggerCb=null] A trigger called when a scenario should be executed. E.g. : `(scenario, additionalInfos) => {}`
     * @param  {string} [title=null]     The title for sub form (can be translation key)
     * @param  {number} [sort=null]      Sort
     * @param {boolean} isList `false` if this is a list of objects, otherwise `false`
     */
    register(formPart, triggerCb = null, title = null, sort = null, isList = false) {
        PrivateProperties.oprivate(this).scenarioManager.register(formPart, triggerCb, title, sort, isList);
    }

    /**
     * Register to scenario execution engine with injection
     *
     * @param  {FormObject} formPart         A form part
     * @param  {Function} [triggerCb=null] A trigger called when a scenario should be executed. E.g. : `(scenario, additionalInfos) => {}`
     * @param  {string} [title=null]     The title for sub form
     * @param  {number} [sort=null]      Sort
     * @param {boolean} isList `false` if this is a list of objects, otherwise `false`
     * @param  {...object} inject Parameters injection on static methods
     */
    registerWithInjection(formPart, triggerCb = null, title = null, sort = null, isList = false, ...inject) {
        PrivateProperties.oprivate(this).scenarioManager.registerWithInjection(formPart, triggerCb, title, sort, isList, ...inject);
    }

    /**
     * Unregister to scenario execution engine
     *
     * @param  {FormObject} formPart         A form part
     * @param  {Function} [triggerCb=null] A trigger called when a scenario should be executed. E.g. : `(scenario) => {}`
     */
    unregister(formPart, triggerCb = null) {
        PrivateProperties.oprivate(this).scenarioManager.unregister(formPart, triggerCb);
    }

    /**
     * Called when a scenario is triggered
     *
     * @param  {ScenarioForm} scenario A scenario
     * @param  {object}  [additionalInfos={}] Additional informations
     */
    triggerScenario(scenario, additionalInfos) {
        PrivateProperties.oprivate(this).scenarioManager.triggerScenario(scenario, false, additionalInfos);
    }

    /**
     * Return a COPY of the scenarios array
     *
     * @returns {[ScenarioForm]} An array of Scenario
     */
    getScenarios() {
        return PrivateProperties.oprivate(this).scenarioManager.getScenarios();
    }

    /**
     * Register for scenario change (scenario creation, modify, delete)
     *
     * @param  {Function} cb A callback `(data) => {}`
     */
    registerForScenarioChanges(cb) {
        PrivateProperties.oprivate(this).scenarioManager.registerForScenarioChanges(cb);
    }
}

module.exports = {class:ScenarioAPI};
