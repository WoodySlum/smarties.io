"use strict";
const PrivateProperties = require("./../PrivateProperties");
const Authentication = require("./../../authentication/Authentication");
const APIResponse = require("../../../services/webservices/APIResponse");
const Cleaner = require("./../../../utils/Cleaner");
const WebServices = require("./../../../services/webservices/WebServices");

/**
 * Public API for Web services
 * @class
 */
class WebAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {WebServices} webServices The web services
    //  * @return {WebAPI}             The instance
    //  */
    constructor(webServices) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).webServices = webServices;
    }
    /* eslint-enable */

    /**
     * Register to a specific web service be notified when a route and/or method is called
     *
     * @param  {Object} delegate     A delegate which implements the processAPI(apiRequest) function
     * @param  {string} [method="*"] A method (*, WebServices.GET / WebServices.POST)
     * @param  {string} [route="*"]  A route (*, :/my/route/)
     * @param  {int} authLevel  An authentification level
     * @param  {int} [tokenExpirationTime=0] A token expiration time in seconds, for token authentication. 0 for one time token.
     *
     */
    register(delegate, method = "*", route = "*", authLevel = Authentication.AUTH_USAGE_LEVEL, tokenExpirationTime = 0) {
        PrivateProperties.oprivate(this).webServices.registerAPI(delegate, method, route, authLevel, tokenExpirationTime);
    }

    /**
     * Unregister to a specific web service be notified when a route and/or method is called
     *
     * @param  {Object} delegate     A delegate which implements the processAPI(apiRequest) function
     * @param  {string} [method="*"] A method (*, WebServices.GET / WebServices.POST)
     * @param  {string} [route="*"]  A route (*, :/my/route/)
     */
    unregister(delegate, method = "*", route = "*") {
        PrivateProperties.oprivate(this).webServices.registerAPI(delegate, method, route);
    }

    /**
     * Get authentication constants : e.g. :  this.webApi.Authentication().AUTH_NO_LEVEL
     *
     * @returns {Object} All constants as properties
     */
    Authentication() {
        return Authentication;
    }

    /**
     * Create an APIResponse object
     *
     * @param  {boolean} [success=false]     Set to true if API success, else false
     * @param  {Object}  [response={}]       A response object to transmit (optional)
     * @param  {int}  [errorCode=-1]         The error code (optional)
     * @param  {string}  [errorMessage=null] The error message (optional)
     * @returns {APIResponse}                 The instance
     */
    APIResponse(success = false, response = {}, errorCode = -1, errorMessage = null) {
        return new APIResponse.class(success, response, errorCode, errorMessage);
    }

    /**
     * Access to web services constants
     *
     * @returns {Object} The constants
     */
    constants() {
        return Cleaner.class.exportConstants(WebServices);
    }

    /**
     * Generates a token
     *
     * @param  {string} route           The route
     * @param  {int} [expirationTime=0] Expiration time - 0 for one time usage
     * @returns {string}                   The token
     */
    getToken(route, expirationTime = 0) {
        return PrivateProperties.oprivate(this).webServices.getToken(route, expirationTime);
    }

}

module.exports = {class:WebAPI};
