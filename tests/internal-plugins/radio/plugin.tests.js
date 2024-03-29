/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var GlobalMocks = require("./../../GlobalMocks");

const SmartiesCore = require("../../../src/SmartiesCore").class;
const core = new SmartiesCore();
const plugin = core.pluginsManager.getPluginByIdentifier("radio", false);
const Radio = plugin.exported.Radio;

describe("Radio", function() {
    before(() => {

    });

    after(() => {
        core.stop();
    });

    it("constructor should have good parameters", function() {
        sinon.spy(plugin.databaseAPI, "register");
        sinon.spy(plugin.webAPI, "register");
        let radio = new Radio(plugin);
        expect(radio).to.have.property("module");
        expect(radio.module).to.be.equal("radio");
        expect(radio.registered.length).to.be.equal(0);
        expect(plugin.instance).to.be.equal(radio);
        expect(plugin.databaseAPI.register.calledOnce).to.be.true;
        expect(plugin.webAPI.register.calledTwice).to.be.true;
        plugin.databaseAPI.register.restore();
        plugin.webAPI.register.restore();
    });

    it("emit should return a valid DbRadio object", function() {
        let radio = new Radio(plugin);
        let res = radio.emit(433.92, "foobar", "foo", "bar", 1);
        expect(res instanceof plugin.exported.DbRadio).to.be.true;
    });

    after(() => {

    });
});
