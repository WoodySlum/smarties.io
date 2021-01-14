/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
const AiManager = require("./../../../src/modules/aimanager/AiManager");

// constructor(configurationPath, eventBus, stopEventName, timeEventService, environmentManager)

describe("AiManager", function() {

    const eventBusMock = {
        on: () => {}
    }

    const timeEventServiceMock = {
        register: () => {}
    }

    const environmentManagerMock = {
        getCoordinates: () => { return {longitude: 0, latitude: 0} },
        getCountry: () => { return "FR" },
        getSeason: () => { return "winter" }
    }

    const threadsManagerMock = {
        run: () => {},
        send: () => {}
    }

    beforeEach(() => {

    });

    it("constructor should call several methods for intialization", () => {
        sinon.spy(eventBusMock, "on");
        sinon.spy(timeEventServiceMock, "register");
        const aiManager = new AiManager.class("/tmp", eventBusMock, "stop", timeEventServiceMock, environmentManagerMock, null, null, threadsManagerMock);
        expect(eventBusMock.on.calledOnce).to.be.true;
        expect(timeEventServiceMock.register.calledOnce).to.be.true;
        expect(Object.keys(aiManager.classifiers).length).to.be.equal(0);
        eventBusMock.on.restore();
        timeEventServiceMock.register.restore();
    });

    it("register should create entry", () => {
        const aiManager = new AiManager.class("/tmp", eventBusMock, "stop", timeEventServiceMock, environmentManagerMock, null, null, threadsManagerMock);
        aiManager.register("foobar");
        expect(Object.keys(aiManager.classifiers).length).to.be.equal(1);
        expect(aiManager.classifiers.foobar).to.be.not.null;
        expect(aiManager.classifiers.foobar.constructor.name === "Naivebayes").to.be.true;
    });

    it("learn and guess model", (done) => {
        const aiManager = new AiManager.class("/tmp", eventBusMock, "stop", timeEventServiceMock, environmentManagerMock, null, null, threadsManagerMock);
        aiManager.register("foobar");

        aiManager.learn("foobar", ["foo", "day"], "POSITIVE")
        .then(aiManager.learn("foobar", ["bar", "night"], "NEGATIVE"))
        .then(aiManager.learn("foobar", ["ofo", "night"], "POSITIVE"))
        .then(aiManager.learn("foobar", ["ofo", "day"], "POSITIVE"))
        .then(aiManager.guess("foobar", ["day"])
            .then((r) => {
                expect(r).to.be.equal("POSITIVE");
                done();
            })
        )
        .catch((e) => {
            expect(false).to.be.true;
        })
    });

    afterEach(() => {

    });
});
