"use strict";

/**
 * Utility class for conversion
 *
 * @class
 */
class Convert {
    /**
     * Convert key / values object into a single one. Example `[{key:"Foo", value:"Bar"}]` will become `{Foo:"Bar"}`
     *
     * @param  {object} inputObject An input object
     * @returns {object}             An output object
     */
    static convertProperties(inputObject) {
        let output = {};
        inputObject.forEach((p) => {
            output[p.key] = p.value;
        });
        return output;
    }
}

module.exports = {class:Convert};
