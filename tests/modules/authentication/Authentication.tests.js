/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var GlobalMocks = require("./../../GlobalMocks");

const Authentication = require("./../../../src/modules/authentication/Authentication");
const SmartiesCore = require("./../../../src/SmartiesCore").class;
const core = new SmartiesCore();
const environmentManager = core.environmentManager;
const webServices = core.webServices;
const userManager = core.userManager;

describe("Authentication", function() {

    before(() => {

    });

    after(() => {
        core.stop();
    });

    it("checkLocalPort should return true", function() {
        sinon.stub(environmentManager, "getLocalIp").callsFake(() => {
            return "192.168.0.54";
        });
        const authentication = new Authentication.class(webServices, userManager, environmentManager);
        expect(authentication.checkLocalIp("192.168.0.12")).to.be.true;
        environmentManager.getLocalIp.restore();
    });

    it("checkLocalPort should return false", function() {
        sinon.stub(environmentManager, "getLocalIp").callsFake(() => {
            return "192.168.1.54";
        });
        const authentication = new Authentication.class(webServices, userManager, environmentManager);
        expect(authentication.checkLocalIp("192.168.0.12")).to.be.false;
        environmentManager.getLocalIp.restore();
    });

    it("checkLocalPort should return false (second try)", function() {
        sinon.stub(environmentManager, "getLocalIp").callsFake(() => {
            return "192.168.0.22";
        });
        const authentication = new Authentication.class(webServices, userManager, environmentManager);
        expect(authentication.checkLocalIp("72.138.45.30")).to.be.false;
        environmentManager.getLocalIp.restore();
    });



    after(function () {

    });
});
