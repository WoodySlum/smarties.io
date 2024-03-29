/*eslint "require-jsdoc": 0*/
"use strict";

const AuthenticationData = require("./AuthenticationData");
const APIResponse = require("./../../services/webservices/APIResponse");
const DateUtils = require("./../../utils/DateUtils");
const Logger = require("./../../logger/Logger");
const sha256 = require("sha256");

const USERNAME = "u";
const PASSWORD = "p";
const TOKEN    = "t";
const HEADER_OLD_USERNAME = "X-HAUTOMATION-USERNAME";
const HEADER_OLD_PASSWORD = "X-HAUTOMATION-PASSWORD";
const HEADER_OLD_TOKEN = "X-HAUTOMATION-TOKEN";
const HEADER_USERNAME = "X-SMARTIES-USERNAME";
const HEADER_PASSWORD = "X-SMARTIES-PASSWORD";
const HEADER_TOKEN = "X-SMARTIES-TOKEN";
const AUTH_NO_LEVEL = 0;
const AUTH_LOCAL_NETWORK_LEVEL = 5;
const AUTH_GUEST_LEVEL = 7;
const AUTH_USAGE_LEVEL = 10;
const AUTH_TABLET_LEVEL = 20;
const AUTH_ADMIN_LEVEL = 80;
const AUTH_DEV_LEVEL = 90;
const AUTH_MAX_LEVEL = 100;
const TOKEN_DEFAULT_VALIDITY = 3 *  60 * 60;

const LOGIN_ROUTE = ":/login/";
const TOKEN_ROUTE_BASE = ":/token/get/";
const TOKEN_ROUTE = TOKEN_ROUTE_BASE + "[serviceIdentifier]/";

/**
 * This class manage authentication for Web Services
 *
 * @class
 */
class Authentication {

    /**
     * Constructor
     *
     * @param  {WebService} webService  The web service instance
     * @param  {UserManager} userManager User manager
     * @param  {EnvironmentManager} environmentManager Environment manager
     *
     * @returns {Authentication} Instance
     */
    constructor(webService, userManager, environmentManager) {
        const GET = "GET"; // WebServices.GET : module exports inside circular dependency fix
        webService.registerAPI(this, "*", "*", AUTH_NO_LEVEL);
        webService.registerAPI(this, GET, LOGIN_ROUTE, AUTH_GUEST_LEVEL);
        webService.registerAPI(this, GET, TOKEN_ROUTE, AUTH_USAGE_LEVEL);
        this.userManager = userManager;
        this.environmentManager = environmentManager;
        this.webServices = webService;
        this.webServices.setAuthentication(this);
        this.tokens = {};
    }

    /**
     * Clear expired tokens
     */
    clearExpiredTokens() {
        const timestamp = DateUtils.class.timestamp();
        Object.keys(this.tokens).forEach((userId) => {
            const expiredIndices = [];
            for (let i = 0 ; i < this.tokens[userId].length ; i++) {
                if (parseInt(timestamp) > parseInt(this.tokens[userId][i].expiration)) {
                    // Expired
                    expiredIndices.push(i);
                    Logger.verbose("Expired token for user " + userId + " : " + this.tokens[userId][i].token);
                }
            }

            expiredIndices.forEach((indice) => {
                this.tokens[userId].splice(indice, 1);
            });
        });
    }

    /**
     * Generates a token
     *
     * @param  {string} username           The username
     * @param  {string} serviceIdentifier  The service identifier
     * @param  {int} [expirationTime=0] Expiration time
     * @returns {string}                   The token
     */
    generateToken(username = null, serviceIdentifier, expirationTime = 0) {
        if (!username) {
            username = this.userManager.getAdminUser().username;
        }
        const token = sha256((serviceIdentifier + username + DateUtils.class.timestamp() + ((Math.random() * 10000000) + 1)).toString()).substr(((Math.random() * 40) + 1), 16);
        if (!this.tokens[username]) {
            this.tokens[username] = [];
        }

        this.tokens[username].push({token:token, expiration:(DateUtils.class.timestamp() + ((expirationTime === 0)?TOKEN_DEFAULT_VALIDITY:expirationTime)), expirationTime: expirationTime, serviceIdentifier: serviceIdentifier});

        return token;
    }

    /**
     * Process API callback
     *
     * @param  {APIRequest} apiRequest An APIRequest
     * @returns {Promise}  A promise with an APIResponse object
     */
    processAPI(apiRequest) {
        this.clearExpiredTokens();
        let t = this;
        let promises = [];
        promises.push(new Promise(function (resolve, reject) {
            t.processAuthentication(apiRequest, resolve, reject);
        }));

        if (apiRequest.route === LOGIN_ROUTE) {
            promises.push(new Promise(function (resolve) {
                resolve(new APIResponse.class(true, Object.assign(apiRequest.authenticationData, {defaultConfig:t.environmentManager.isDefaultConfig()})));
            }));
        } else if (apiRequest.route.startsWith(TOKEN_ROUTE_BASE)) {
            promises.push(new Promise(function (resolve, reject) {
                let expirationTime = 0;
                let found = false;
                if (apiRequest.data.serviceIdentifier && apiRequest.authenticationData.username) {
                    t.webServices.delegates.forEach((delegate) => {
                        if (delegate && delegate.identifier && delegate.identifier === apiRequest.data.serviceIdentifier) {
                            expirationTime = delegate.authTokenExpiration;
                            found = true;
                        }
                    });

                    if (found) {
                        const token = t.generateToken(apiRequest.authenticationData.username, apiRequest.data.serviceIdentifier, expirationTime);
                        Logger.verbose("New token generate. Token : " + token + " User : " + apiRequest.authenticationData.username + " Service identifier : " + apiRequest.data.serviceIdentifier);
                        resolve(new APIResponse.class(true, {token:token}));
                    } else {
                        reject(new APIResponse.class(false, {}, 4567, "No identifier matched"));
                    }
                } else {
                    resolve(new APIResponse.class(true, {}));
                }
            }));
        }

        return promises;
    }

    /**
     * Check if an ip is on the same network
     *
     * @param  {string} ipSource The source ip
     * @returns {boolean}          `true` if the ip is on the same network, `false` otherwise
     */
    checkLocalIp(ipSource) {
        const localIp = this.environmentManager.getLocalIp();
        const ipSourceExploded = ipSource.split(".");
        const localIpExploded = localIp.split(".");
        if (ipSourceExploded.length === 4 && localIpExploded.length === 4) {
            if (parseInt(ipSourceExploded[0]) === parseInt(localIpExploded[0]) && parseInt(ipSourceExploded[1]) === parseInt(localIpExploded[1]) && parseInt(ipSourceExploded[2]) === parseInt(localIpExploded[2])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Process authentication
     *
     * @param  {APIRequest} apiRequest The api request
     * @param  {Function} resolve    The resolve function
     * @param  {Function} reject     The reject function
     */
    processAuthentication(apiRequest, resolve, reject) {
        let u = apiRequest.params[USERNAME]?apiRequest.params[USERNAME]:(apiRequest.req.headers[HEADER_USERNAME.toLowerCase()]?apiRequest.req.headers[HEADER_USERNAME.toLowerCase()]:(apiRequest.req.headers[HEADER_OLD_USERNAME.toLowerCase()]?apiRequest.req.headers[HEADER_OLD_USERNAME.toLowerCase()]:null));
        let p = apiRequest.params[PASSWORD]?apiRequest.params[PASSWORD]:(apiRequest.req.headers[HEADER_PASSWORD.toLowerCase()]?apiRequest.req.headers[HEADER_PASSWORD.toLowerCase()]:(apiRequest.req.headers[HEADER_OLD_PASSWORD.toLowerCase()]?apiRequest.req.headers[HEADER_OLD_PASSWORD.toLowerCase()]:null));
        let t = apiRequest.params[TOKEN]?apiRequest.params[TOKEN]:(apiRequest.req.headers[HEADER_TOKEN.toLowerCase()]?apiRequest.req.headers[HEADER_TOKEN.toLowerCase()]:(apiRequest.req.headers[HEADER_OLD_TOKEN.toLowerCase()]?apiRequest.req.headers[HEADER_OLD_TOKEN.toLowerCase()]:null));

        //let t = apiRequest.params[TOKEN];
        let admin = this.userManager.getAdminUser();
        let users = this.userManager.getUsers();
        let userAuth = null;

        if (admin) {
            users.push(admin);
        }

        // Check for validity token
        if (t) {
            let deletedIndex = -1;
            let detectedUsername = null;
            Object.keys(this.tokens).forEach((username) => {
                let i = 0;
                this.tokens[username].forEach((tokenData) => {
                    if (apiRequest.apiRegistration && (tokenData.serviceIdentifier === apiRequest.apiRegistration.identifier)
                        && (t === tokenData.token)){
                        detectedUsername = username;
                        if (tokenData.expirationTime === 0) {
                            deletedIndex = i;
                        }
                    }
                    i++;
                });
            });

            if (detectedUsername) {
                // Set username to token
                users.forEach((user) => {
                    if (detectedUsername.toLowerCase() === user.username.toLowerCase()) {
                        userAuth = user;
                    }
                });

                // Clean one time validity token
                if (deletedIndex > -1) {
                    Logger.verbose("Clearing token " + this.tokens[detectedUsername][deletedIndex].token);
                    this.tokens[detectedUsername].splice(deletedIndex, 1);
                }
            }
        }

        if (!userAuth) {
            users.forEach((user) => {
                if (u && user.username && u.toLowerCase() === user.username.toLowerCase() && p === user.password) {
                    userAuth = user;
                    return;
                }
            });
        }

        if (!u && !p && !t) {
            if (this.checkLocalIp(apiRequest.ip)) {
                apiRequest.addAuthenticationData(new AuthenticationData.class(false, null, AUTH_LOCAL_NETWORK_LEVEL));
            } else {
                apiRequest.addAuthenticationData(new AuthenticationData.class(false, null, AUTH_NO_LEVEL));
            }

            resolve(new APIResponse.class(true));
        } else if (userAuth) {
            apiRequest.addAuthenticationData(new AuthenticationData.class(true, userAuth.username, userAuth.level));
            resolve(new APIResponse.class(true));
        } else {
            if (t) {
                reject(new APIResponse.class(false, {}, 821, "Invalid token"));
            } else {
                reject(new APIResponse.class(false, {}, 811, "Invalid username and/or password"));
            }
        }


    }
}

module.exports = {class:Authentication, AUTH_NO_LEVEL:AUTH_NO_LEVEL, AUTH_GUEST_LEVEL:AUTH_GUEST_LEVEL, AUTH_USAGE_LEVEL:AUTH_USAGE_LEVEL, AUTH_ADMIN_LEVEL:AUTH_ADMIN_LEVEL, AUTH_MAX_LEVEL:AUTH_MAX_LEVEL, AUTH_LOCAL_NETWORK_LEVEL:AUTH_LOCAL_NETWORK_LEVEL, AUTH_DEV_LEVEL:AUTH_DEV_LEVEL, AUTH_TABLET_LEVEL:AUTH_TABLET_LEVEL, HEADER_USERNAME:HEADER_USERNAME, HEADER_PASSWORD:HEADER_PASSWORD, HEADER_TOKEN:HEADER_TOKEN, HEADER_OLD_USERNAME:HEADER_OLD_USERNAME, HEADER_OLD_PASSWORD:HEADER_OLD_PASSWORD, HEADER_OLD_TOKEN:HEADER_OLD_TOKEN};
