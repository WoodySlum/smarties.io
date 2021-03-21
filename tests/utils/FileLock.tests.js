/* eslint-env node, mocha */
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");

const FileLock = require("./../../src/utils/FileLock").class;
const SmartiesCore = require("./../../src/SmartiesCore").class;


describe("FileLock", function() {

    before(() => {
        core = new SmartiesCore();
    });

    it("should test file lock", function() {
        const fileLock = new FileLock("/tmp/", core.schedulerService);
        fileLock.lock("foobar");
        expect(fileLock.isLocked("foobar")).to.be.true;
        fileLock.unlock("foobar");
        expect(fileLock.isLocked("foobar")).to.be.false;
        fileLock.unlock("foobar");
        expect(fileLock.isLocked("foobar")).to.be.false;
    });

    after(() => {

    });
});
