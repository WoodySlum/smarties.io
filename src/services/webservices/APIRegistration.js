"use strict";
var Authentication = require("./../../modules/authentication/Authentication");

const ERROR_INVALID_OPTIONAL_PARAMETER = "Optional fiels should be placed at the end of the URL";

/**
 * This class is a POJO representing an APIRegistration item
 *
 * @class
 */
class APIRegistration {
    /**
     * Constructor
     *
     * @param  {object} delegate  The object which implements the processAPI callback
     * @param  {string} [method="*"] The method (GET, POST, ...)
     * @param  {string} [route="*"] The needed route (:/foo/bar)
     * @param  {int} [authLevel=Authentication.AUTH_USAGE_LEVEL] The authentication level needed to be called
     * @param {string} [identifier=null]  The route service identifier
     * @param {int} [authTokenExpiration=0] The expiration time for token, in seconds
     * @returns {APIRegistration} The instance
     */
    constructor(delegate, method = "*", route = "*", authLevel = Authentication.AUTH_USAGE_LEVEL, identifier = null, authTokenExpiration = 0) {
        /**
         * delegate
         *
         * @type {object}
         */
        this.delegate = delegate;
        /**
         * method
         *
         * @type {string}
         */
        this.method = method;
        /**
         * route
         *
         * @type {string}
         */
        this.route = route;
        /**
         * Authentication level requested for API
         *
         * @type {int} An Authentication constant
         */
        this.authLevel = authLevel;

        this.parameters = [];

        this.routeBase = [];
        this.nbParametersOptional = 0;
        this.identifier = identifier;
        this.authTokenExpiration = authTokenExpiration;

        this.route.split("/").forEach((routeElement) => {
            if (routeElement != ":" && routeElement != "") {
                this.routeBase.push(routeElement);
            }
            const regex = /(\[)([a-zA-Z0-9\-*]+)(\])/g;
            let r = regex.exec(routeElement);
            if (r && r.length > 2) {
                const optional = (r[2].indexOf("*") === -1)?false:true;
                if (optional) {
                    this.nbParametersOptional++;
                }
                if (!optional && this.nbParametersOptional > 0) {
                    throw Error(ERROR_INVALID_OPTIONAL_PARAMETER);
                }

                this.route = this.route.replace("/" + routeElement, "");
                this.parameters.push({name:r[2].replace("*", ""),optional:optional});
            }
        });
    }

    /**
     * Check if the parameter equality
     *
     * @param  {APIRegistration}  obj   An APIRegistration object
     * @returns {boolean}     true or false
     */
    isEqual(obj) {
        if (obj.delegate.constructor.name === this.delegate.constructor.name && obj.method === this.method && obj.route === this.route) {
            return true;
        }
        return false;
    }

    /**
     * Returns the route base string
     *
     * @returns {string} The base route (without parameters)
     */
    getRouteBase() {
        const routeBase = [];
        this.routeBase.forEach((rbElement) => {
            if (rbElement.indexOf("[") === -1) {
                routeBase.push(rbElement);
            }
        });

        return ":/" + routeBase.join("/") + "/";
    }
}

module.exports = {class:APIRegistration, ERROR_INVALID_OPTIONAL_PARAMETER:ERROR_INVALID_OPTIONAL_PARAMETER};
