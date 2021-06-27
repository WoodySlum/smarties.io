/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var moment = require("moment-timezone");
const TimerWrapper = require("./../../src/utils/TimerWrapper");

describe("TimerWrapper", function() {

    before(() => {

    });

    it("setInterval should wrap generic function", function(done) {
        const interval = TimerWrapper.class.setInterval((p, p2) => {
            TimerWrapper.class.clearInterval(interval);
            expect(p).to.be.equal("foo");
            expect(p2).to.be.equal("bar");
            done();
        }, 500, "foo", "bar");
    });

    it("setTimeout should wrap generic function", function(done) {
        TimerWrapper.class.setTimeout((p, p2) => {
            expect(p).to.be.equal("foo");
            expect(p2).to.be.equal("bar");
            done();
        }, 500, "foo", "bar");
    });

    it("setImmediate should wrap generic function", function(done) {
        TimerWrapper.class.setImmediate((p, p2) => {
            expect(p).to.be.equal("foo");
            expect(p2).to.be.equal("bar");
            done();
        }, "foo", "bar");
    });

    it("clearAll should clear all timers", function() {
        const interval = TimerWrapper.class.setInterval(() => {expect(false).to.be.true;}, 5000);
        const interval2 = TimerWrapper.class.setInterval(() => {expect(false).to.be.true;}, 5000);
        const timeout = TimerWrapper.class.setInterval(() => {expect(false).to.be.true;}, 5000);
        const timeout2 = TimerWrapper.class.setInterval(() => {expect(false).to.be.true;}, 5000);
        TimerWrapper.class.clearInterval(interval);
        TimerWrapper.class.clearTimeout(timeout);
        TimerWrapper.class.clearAll();
    });

    after(() => {

    });
});
