/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var GlobalMocks = require("./../../GlobalMocks");

const SmartiesCore = require("./../../../src/SmartiesCore").class;
const GatewayManager = require("./../../../src/modules/gatewaymanager/GatewayManager");
const TimeEventService = require("./../../../src/services/timeeventservice/TimeEventService");
const SmartiesRunnerConstants = require("./../../../SmartiesRunnerConstants");

let core;
describe("GatewayManager", function() {
    before(() => {
        core = new SmartiesCore();
    });

    after(() => {
        core.stop();
    });

    it("constructor should init correctly stuff", function() {
        const tesSpy = sinon.spy(core.timeEventService, "register");
        const eventSpy = sinon.spy(core.eventBus, "on");
        sinon.spy(GatewayManager.class.prototype, "transmit");
        const gatewayManager = new GatewayManager.class(core.environmentManager, "1.0", "aaaaaa", core.timeEventService, {}, core.webServices, core.eventBus, core.scenarioManager, core.threadsManager, core.messageManager, core.translateManager, "FOOBAR", "BARFOO");
        expect(tesSpy.withArgs(sinon.match.any, gatewayManager, TimeEventService.EVERY_HOURS_INACCURATE).calledOnce).to.be.true;
        expect(eventSpy.withArgs("FOOBAR", sinon.match.any).calledOnce).to.be.true;
        expect(eventSpy.withArgs("BARFOO", sinon.match.any).calledOnce).to.be.true;
        expect(eventSpy.withArgs(SmartiesRunnerConstants.RESTART, sinon.match.any).calledOnce).to.be.true;
        expect(GatewayManager.class.prototype.transmit.calledOnce).to.be.true;

        core.timeEventService.register.restore();
        core.eventBus.on.restore();
        GatewayManager.class.prototype.transmit.restore();
    });

    after(() => {

    });
});
