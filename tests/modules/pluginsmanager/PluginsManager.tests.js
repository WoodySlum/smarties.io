/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
const SmartiesCore = require("./../../../src/SmartiesCore").class;
var GlobalMocks = require("./../../GlobalMocks");
var SmartiesRunnerConstants = require("./../../../SmartiesRunnerConstants");
var PluginsManager = require("./../../../src/modules/pluginsmanager/PluginsManager");
var PluginAPI = require("./../../../src/modules/pluginsmanager/PluginAPI");
var WebServices = require("./../../../src/services/webservices/WebServices");
const TEST_PLUGIN = "rflink";

let core;
const eventBus = {on:()=>{}};

let userManager;
let servicesManager;
let dbManager;
let translateManager;
let formManager;
let confManager;
let timeEventService;
let schedulerService;
let dashboardManager;
let themeManager;
let sensorsManager;
let installationManager;
let messageManager;
let scenarioManager;
let alarmManager;
let camerasManager;
let radioManager;
let environmentManager;
let pluginsManager;
let iotManager;
let botEngine;
let deviceManager;
let backupManager;
let gatewayManager;


describe("PluginsManager", function() {
    let pluginsManager;
    let webServices;
    let pluginA;
    let pluginB;
    let pluginC;
    let pluginD;
    let pluginInvalidDependencies;
    let pluginARef = {attributes : {
        loadedCallback: (api) => {},
        name: "a",
        version: "0.0.0",
        category: "misc",
        description: "desc",
        dependencies:["b"]
    }};
    let pluginBRef = {attributes : {
        loadedCallback: (api) => {},
        name: "b",
        version: "0.0.0",
        category: "misc",
        description: "desc"
    }};
    let pluginCRef = {attributes : {
        loadedCallback: (api) => {},
        name: "c",
        version: "0.0.0",
        category: "misc",
        description: "desc",
        dependencies:["a"]
    }};
    let pluginDRef = {attributes : {
        loadedCallback: (api) => {},
        name: "d",
        version: "0.0.0",
        category: "misc",
        description: "desc"
    }};
    let pluginInvalidAttRef = { attributes : {
        loadedCallback: (api) => {},
        version: "0.0.0",
        category: "misc",
        description: "desc"
    }};
    let pluginInvalidCallbackRef = { attributes : {
        loadedCallback: "cb",
        name:"invalid-callback",
        version: "0.0.0",
        category: "misc",
        description: "desc"
    }};
    let pluginInvalidDependenciesRef = { attributes : {
        loadedCallback: (api) => {},
        name:"invalid-callback",
        version: "0.0.0",
        category: "misc",
        description: "desc",
        dependencies:["a", "z"]
    }};



    before(() => {
        core = new SmartiesCore();
        userManager = core.userManager;
        servicesManager = core.servicesManager;
        dbManager = core.dbManager;
        translateManager = core.translateManager;
        formManager = core.formManager;
        confManager = core.confManager;
        timeEventService = core.timeEventService;
        schedulerService = core.schedulerService;
        dashboardManager = core.dashboardManager;
        themeManager = core.themeManager;
        sensorsManager = core.sensorsManager;
        installationManager = core.installationManager;
        messageManager = core.messageManager;
        scenarioManager = core.scenarioManager;
        alarmManager = core.alarmManager;
        camerasManager = core.camerasManager;
        radioManager = core.radioManager;
        environmentManager = core.environmentManager;
        pluginsManager = core.pluginsManager;
        iotManager = core.iotManager;
        botEngine = core.botEngine;
        deviceManager = core.deviceManager;
        backupManager = core.backupManager;
        gatewayManager = core.gatewayManager;
        const appConfiguration = {cachePath:"foobar"};
        webServices = sinon.mock(WebServices.class);
        webServices.registerAPI = ()=>{};
        webServices.getToken = ()=>{};
        sinon.stub(PluginsManager.class.prototype, 'load');
        pluginsManager = new PluginsManager.class({}, webServices);

        pluginA = new PluginAPI.class("0.0.0", pluginARef, webServices, appConfiguration, servicesManager, dbManager, translateManager, formManager, confManager, timeEventService, schedulerService, dashboardManager, themeManager, sensorsManager, installationManager, userManager, messageManager, scenarioManager, alarmManager, camerasManager, radioManager, environmentManager, pluginsManager, iotManager, botEngine, eventBus, deviceManager, backupManager, gatewayManager);
        pluginB = new PluginAPI.class("0.0.0", pluginBRef, webServices, appConfiguration, servicesManager, dbManager, translateManager, formManager, confManager, timeEventService, schedulerService, dashboardManager, themeManager, sensorsManager, installationManager, userManager, messageManager, scenarioManager, alarmManager, camerasManager, radioManager, environmentManager, pluginsManager, iotManager, botEngine, eventBus, deviceManager, backupManager, gatewayManager);
        pluginC = new PluginAPI.class("0.0.0", pluginCRef, webServices, appConfiguration, servicesManager, dbManager, translateManager, formManager, confManager, timeEventService, schedulerService, dashboardManager, themeManager, sensorsManager, installationManager, userManager, messageManager, scenarioManager, alarmManager, camerasManager, radioManager, environmentManager, pluginsManager, iotManager, botEngine, eventBus, deviceManager, backupManager, gatewayManager);
        pluginD = new PluginAPI.class("0.0.0", pluginDRef, webServices, appConfiguration, servicesManager, dbManager, translateManager, formManager, confManager, timeEventService, schedulerService, dashboardManager, themeManager, sensorsManager, installationManager, userManager, messageManager, scenarioManager, alarmManager, camerasManager, radioManager, environmentManager, pluginsManager, iotManager, botEngine, eventBus, deviceManager, backupManager, gatewayManager);
        pluginInvalidDependencies = new PluginAPI.class("0.0.0", pluginInvalidDependenciesRef, webServices, appConfiguration, servicesManager, dbManager, translateManager, formManager, confManager, timeEventService, schedulerService, dashboardManager, themeManager, sensorsManager, installationManager, userManager, messageManager, scenarioManager, alarmManager, camerasManager, radioManager, environmentManager, pluginsManager, iotManager, botEngine, eventBus, deviceManager, backupManager, gatewayManager);

    });

    after(() => {
        core.stop();
    });

    it("default constructor should call load in constructor", function() {
        expect(pluginsManager).to.have.property("plugins");
        expect(pluginsManager.plugins.length).to.be.equal(0);
        expect(pluginsManager.load.calledOnce).to.be.true;
    });

    it("sanitize should detect missing property", function() {
        try {
            pluginsManager.checkPluginSanity(pluginInvalidAttRef);
            expect(false).to.be.true; // This should not happened because an exception is thrown
        } catch (e) {
            expect(e.message).to.be.equal(PluginsManager.ERROR_MISSING_PROPERTY);
        }
    });

    it("sanitize should detect loaded callback", function() {
        try {
            pluginsManager.checkPluginSanity(pluginInvalidCallbackRef);
            expect(false).to.be.true; // This should not happened because an exception is thrown
        } catch (e) {
            expect(e.message).to.be.equal(PluginsManager.ERROR_NOT_A_FUNCTION);
        }
    });

    it("sanitize should detect not loaded depedencies", function() {
        try {
            pluginsManager.checkPluginSanity(pluginInvalidDependenciesRef, [pluginA, pluginInvalidDependencies]);
            expect(false).to.be.true; // This should not happened because an exception is thrown
        } catch (e) {
            expect(e.message).to.be.equal(PluginsManager.ERROR_DEPENDENCY_NOT_FOUND);
        }
    });

    // Toposort testing function

    it("should prepare array for toposort", function() {
        const preparedArray = pluginsManager.prepareToposortArray([pluginA, pluginB, pluginC, pluginD].slice());
        expect(preparedArray[0][0]).to.be.equal("a");
        expect(preparedArray[0][1]).to.be.equal("b");
        expect(preparedArray[1][0]).to.be.equal("b");
        expect(preparedArray[2][0]).to.be.equal("c");
        expect(preparedArray[2][1]).to.be.equal("a");
        expect(preparedArray[3][0]).to.be.equal("d");

    });

    it("should sort plugin identifiers with dependencies", function() {
        const preparedArray = pluginsManager.prepareToposortArray([pluginA, pluginB, pluginC, pluginD]);
        const sortedArray = pluginsManager.toposort(preparedArray);
        // d, b, a, c
        expect(sortedArray.length).to.be.equal(4);
        expect(sortedArray[0]).to.be.equal("d");
        expect(sortedArray[1]).to.be.equal("b");
        expect(sortedArray[2]).to.be.equal("a");
        expect(sortedArray[3]).to.be.equal("c");
    });

    it("should convert sorted array identifier into plugins", function() {
        const plugins = [pluginA, pluginB, pluginC, pluginD];
        const preparedArray = pluginsManager.prepareToposortArray(plugins);
        const toposortedArray = pluginsManager.toposort(preparedArray);
        const sortedPlugins = pluginsManager.topsortedArrayConverter(toposortedArray, plugins);
        // d, b, a, c
        expect(sortedPlugins.length).to.be.equal(4);
        expect(sortedPlugins[0] instanceof PluginAPI.class).to.be.true;
        expect(sortedPlugins[0].identifier).to.be.equal("d");
        expect(sortedPlugins[1] instanceof PluginAPI.class).to.be.true;
        expect(sortedPlugins[1].identifier).to.be.equal("b");
        expect(sortedPlugins[2] instanceof PluginAPI.class).to.be.true;
        expect(sortedPlugins[2].identifier).to.be.equal("a");
        expect(sortedPlugins[3] instanceof PluginAPI.class).to.be.true;
        expect(sortedPlugins[3].identifier).to.be.equal("c");
    });

    it("disable plugin should return correct value (true)", function() {
        pluginsManager = new PluginsManager.class({}, webServices);
        pluginsManager.pluginsConf = [
            {path:"./../../internal-plugins/",relative:true,identifier:TEST_PLUGIN,version:"0.0.0",dependencies:["radio"], enable:true}
        ];
        expect(pluginsManager.isEnabled(TEST_PLUGIN)).to.be.true;
    });

    it("disable plugin should return correct value (false)", function() {
        pluginsManager = new PluginsManager.class({}, webServices);
        pluginsManager.pluginsConf = [
            {path:"./../../internal-plugins/",relative:true,identifier:TEST_PLUGIN,version:"0.0.0",dependencies:["radio"], enable:false}
        ];
        expect(pluginsManager.isEnabled(TEST_PLUGIN)).to.be.false;
    });

    it("disable plugin with method should be well processed", function() {

        pluginsManager = new PluginsManager.class({}, webServices);
        pluginsManager.pluginsConf = [
            {path:"./../../internal-plugins/",relative:true,identifier:TEST_PLUGIN,version:"0.0.0",dependencies:["radio"], enable:true}
        ];
        pluginsManager.confManager = {setData:(key, object, datas, comparator) => {return datas;}};
        pluginsManager.eventBus = {emit:(event) => {
            expect(event).to.be.equal(SmartiesRunnerConstants.RESTART);
        }};
        sinon.spy(pluginsManager.eventBus, "emit");

        expect(pluginsManager.isEnabled(TEST_PLUGIN)).to.be.true;
        pluginsManager.changePluginStatus(pluginsManager.pluginsConf[0], false);
        expect(pluginsManager.isEnabled(TEST_PLUGIN)).to.be.false;
        expect(pluginsManager.eventBus.emit.calledOnce).to.be.true;
        pluginsManager.eventBus.emit.restore();
    });

    after(function () {
        //pluginsManager.restore();
    });
});
