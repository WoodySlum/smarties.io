"use strict";
var Logger = require("./../../logger/Logger");
const threads = require("threads");
const isRunning = require("is-running");
const ERROR_UNKNOWN_IDENTIFIER = "Unknown thread identifier";
const ERROR_STRINGIFY_FUNCTION_THREAD = "Error in thread stringify function";

/**
 * This class allows to manage threads
 *
 * @class
 */
class ThreadsManager {
    /**
     * Constructor
     *
     * @param  {EventEmitter} eventBus    The global event bus
     * @param  {object} smartiesRunnerConstants Runner constants
     *
     * @returns {ThreadsManager} The thread manager
     */
    constructor(eventBus, smartiesRunnerConstants) {
        this.threads = {};
        this.eventBus = eventBus;
        this.smartiesRunnerConstants = smartiesRunnerConstants;
    }

    /**
     * Stringify a function.
     * Convert a class method to standard method definition, for example
     * `myFunction(a, b) {}` to `(a,b)=>{}`
     * Further detaisl : https://github.com/andywer/threads.js/issues/57
     * This method can throw an error if the regex fails
     *
     * @param  {Function} func A class method or classic function
     * @returns {string}      The normalized function as string, needed to be eval
     */
    stringifyFunc(func) {
        const funcString = func.toString();
        if (funcString.split("\n")[0].indexOf("=>") === -1) {
            const regex = /(\()(.*)(\))([^]{0,1})({)([^]+)(\})/mg;
            let regexResults = regex.exec(funcString);
            if (regexResults.length === 8) {
                const prototype = "(" + regexResults[2] + ") => {" + regexResults[6] + " return this;}";

                return prototype;
            } else {
                throw Error(ERROR_STRINGIFY_FUNCTION_THREAD);
            }
        } else { // Inline func
            return funcString.substring(0, funcString.lastIndexOf("\n")) + "\n return this;}";
        }
    }

    /**
     * Run a function or class method in a separated thread
     * Each code contains in the function is sanboxed and should communicate through data and/or callback API
     * All class methods / data can not be accessed
     * Can throw an error
     *
     * @param  {Function} func            A class method, or classic function. Prototype example : `run(data, message) {}`
     * @param  {string} identifier      The thread identifier
     * @param  {object} [data={}]       Object passed to the threaded code
     * @param  {Function} [callback=null] The callback when a message is received from the thread. Prototype example : `(tData) => {}`
     * @param  {object} [context=null] The context passed as parameter
     */
    run(func, identifier, data = {}, callback = null, context = null) {
        const prototype = this.stringifyFunc(func);
        const self = this;

        const thread  = threads.spawn((input, done, progress) => {
            const Logger = require(input.dirname + "/../../logger/Logger", "may-exclude");
            try {
                this.process.title = "smarties.io child [" + input.identifier + "]";
                const os = require("os");
                try {
                    os.setPriority(process.pid, 0); // Normal priority
                } catch(e) {
                    Logger.err(e);
                }
                let f = eval(input.prototype);
                let instance = f(input.data, progress);

                this.process.on("message", (d) => {
                    if (d && d.event) {
                        if (typeof instance[d.event] === "function") {
                            instance[d.event](d.data);
                        } else {
                            Logger.err("Thread '" + input.identifier + "' has invalid or unimplemented function type for event '" + d.event + "'");
                        }
                    }
                });
            } catch(e) {
                // Log thread error !
                const regex = /(.*)(:)([0-9]+)(:)(.*)/g;
                const lineStack = e.stack.toString().split("\n")[1];
                const lineIdentified = parseInt(regex.exec(lineStack)[3]) - 1;
                let code = input.prototype.split("\n")[lineIdentified];
                Logger.err("Exception '" + e.message + "' in thread " + input.identifier + " on l." + lineIdentified + ". Code : " + code);
            }
            done(input.identifier);
        })
            .send({dirname: __dirname, identifier:identifier, prototype:prototype, data:data})
            .on("progress", (tData) => {
                if (callback) {
                    callback(tData, self, context);
                }
            })
            .on("error", (error) => {
                Logger.err("Error in thread " + identifier);
                Logger.err(error);
            })
            .on("done", () => {

            });

        this.threads[identifier] = thread;
        if (!process.env.TEST) {
            this.eventBus.emit(this.smartiesRunnerConstants.PID_SPAWN, thread.slave.pid);
        }
    }

    /**
     * Send data to thread. In the thread method, the `event` should be impelemented as :
     *     myFunction(data, message) {
     *         this.myEvent = (data) {
     *
     *         }
     *     }
     * Then call function :
     * `threadManager.send("identifier", "myEvent", {value:"foo"})`
     * Can throw error if thread does not exists
     *
     * @param  {string} identifier  The thread identifier
     * @param  {string} event       The event's name
     * @param  {object} [data=null] Any data passed to thread
     */
    send(identifier, event, data = null) {
        if (this.threads[identifier] && this.isRunning(identifier)) {
            this.threads[identifier].slave.send({event:event, data:data});
        } else {
            throw Error(ERROR_UNKNOWN_IDENTIFIER + " " + identifier);
        }
    }

    /**
     * Kill the thread
     * Throw a ERROR_UNKNOWN_IDENTIFIER error if the identifier is unknown
     *
     * @param  {string} identifier Thread identifier
     */
    kill(identifier) {
        if (this.threads[identifier] && this.isRunning(identifier)) {
            this.threads[identifier].kill();
            delete this.threads[identifier];
            Logger.info("Thread " + identifier + " has been terminated");
        } else {
            throw Error(ERROR_UNKNOWN_IDENTIFIER);
        }
    }

    /**
     * Kill all running threads
     */
    killAll() {
        Object.keys(this.threads).forEach((identifier) => {
            if (this.isRunning(identifier)) {
                this.threads[identifier].kill();
                delete this.threads[identifier];
            }
        });
    }

    /**
     * Returns the pid of the thread
     *
     * @param  {string} identifier Thread identifier
     * @returns {int}            The pid, if not found send back null
     */
    getPid(identifier) {
        if (this.threads[identifier]) {
            return this.threads[identifier].slave.pid;
        } else {
            return null;
        }
    }

    /**
     * Check if the thread is running or not
     *
     * @param  {string} identifier Thread identifier
     * @returns {boolean}            True or false
     */
    isRunning(identifier) {
        const pid = this.getPid(identifier);
        return pid?isRunning(pid):false;
    }
}

module.exports = {class:ThreadsManager,
    ERROR_UNKNOWN_IDENTIFIER:ERROR_UNKNOWN_IDENTIFIER,
    ERROR_STRINGIFY_FUNCTION_THREAD:ERROR_STRINGIFY_FUNCTION_THREAD
};
