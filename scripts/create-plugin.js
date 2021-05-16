const fs = require("fs-extra");
const colors = require("colors");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
});

const tplForm = `
    /**
    * This class is used for %PNAME% form
    *
    * @class
    */
    class %PCLASSNAME%Form extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} example       An example
         *
         * @returns {%PCLASSNAME%Form}              The instance
         */
        constructor(id, example) {
            super(id);

            /**
             * @Property("example");
             * @Type("string");
             * @Title("example.form");
             */
            this.example = example;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {%PCLASSNAME%Form}      A form object
         */
        json(data) {
            return new %PCLASSNAME%Form(data.id, data.example);
        }
    }

    api.configurationAPI.register(%PCLASSNAME%Form);
`;

const tpl = `"use strict";
/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();
    %PCONFFORM%
    /**
     * %PNAME% class
     *
     * @class
     */
    class %PCLASSNAME% {
        /**
         * %PNAME%
         *
         * @param  {PluginAPI} api   A plugin api
         *
         * @returns {%PCLASSNAME%}  The instance
         */
        constructor(api) {
            this.api = api;
        }
    }

    // Ig this class should be exposed, uncomment next line and remove new instance
    // api.registerInstance(new %PCLASSNAME%(api));
    new %PCLASSNAME%(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "%PNAME%",
    version: "0.0.0",
    category: "%PCATEGORY%",
    description: "%PDESCRIPTION%",
    defaultDisabled: true,
    dependencies:[%PDEPENDENCIES%]
};`;


const header = (text) => {
    return colors.bold.grey.black.blue(text);
};

const error = (text) => {
    return colors.red(text);
};

const success = (text) => {
    return colors.green(text);
};

const capitalizeTheFirstLetterOfEachWord = (words) => {
   var separateWord = words.toLowerCase().split(" ");
   for (var i = 0; i < separateWord.length; i++) {
      separateWord[i] = separateWord[i].charAt(0).toUpperCase() +
      separateWord[i].substring(1);
   }
   return separateWord.join(' ');
};

readline.question(header("Plugin identifier (e.g. : my-plugin) : "), identifier => {
    readline.question(header("Plugin description (e.g. : My plugin description) : "), description => {
        readline.question(header("Plugin category (e.g. camera) : "), category => {
            readline.question(header("Plugin dependencies (separate with ',') : "), dependencies => {
                readline.question(header("Init configuration form ? (y/n) : "), confForm => {
                    const pdir = "./plugins/" + identifier + "/";
                    if (!fs.pathExistsSync(pdir)) {
                        const pName = identifier.replace(/ /g, "");
                        const pClassName = capitalizeTheFirstLetterOfEachWord(pName.replace(/-/g, " ").replace(/_/g, " ")).replace(/ /g, "");
                        let pCategory = "misc";
                        if (category && category.length > 0) {
                            pCategory = category.replace(/ /g, "");
                        }
                        let pDependencies = "";
                        if (dependencies && dependencies.length > 0) {
                            let dependenciesSplit = dependencies.replace(/ /g, "").split(",");
                            pDependencies = "\"" + dependenciesSplit.join("\",\"") + "\"";
                        }

                        let plugin = tpl;
                        let pConfForm = "";
                        if (confForm == "y") {
                            pConfForm = tplForm;
                        }

                        plugin = plugin.replace(/%PCONFFORM%/g, pConfForm).replace(/%PNAME%/g, pName).replace(/%PCLASSNAME%/g, pClassName).replace(/%PCATEGORY%/g, pCategory).replace(/%PDESCRIPTION%/g, description).replace(/%PDEPENDENCIES%/g, pDependencies);

                        fs.ensureDirSync(pdir);
                        fs.ensureDirSync(pdir + "lng/");
                        fs.writeFileSync(pdir + "lng/en.json", "{\n\n}");
                        fs.writeFileSync(pdir + "plugin.js", plugin);


                        console.log(success("Plugin " + pName + " created at path " + pdir));
                    } else {
                        console.log(error("Dir " + pdir + " exists"));
                    }
                    readline.close();
                });
            });
        });
    });
});
