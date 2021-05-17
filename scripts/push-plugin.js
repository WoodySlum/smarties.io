const fs = require("fs-extra");
const zipdir = require("zip-dir");
const colors = require("colors");
const request = require("request");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
});
const PLUGIN_DIR = "./plugins/";
const TMP_DIR = "/tmp/";
const PLUGINS_URL = "https://plugins.smarties.io/";
const data = fs.readdirSync(PLUGIN_DIR);
const plugins = [];
data.forEach((file) => {
    if (file.substring(0, 1) != "." && fs.statSync(PLUGIN_DIR + file + "/plugin.js")) {
        plugins.push(file);
    }
});

const header = (text) => {
    return colors.bold.grey.black.blue(text);
};

const error = (text) => {
    return colors.red(text);
};

const success = (text) => {
    return colors.green(text);
};
console.log(colors.bold.grey.black.gray("Smarties Plugin Uploader. Please do not forgot to set environment variables SMARTIES_USERNAME and SMARTIES_TOKEN"));
console.log(header("Select plugin :"));
for (let i = 0; i < plugins.length ; i++) {
    console.log(colors.magenta(i + ". " + plugins[i]));
}

readline.question(header("Number : "), num => {
    const i = parseInt(num);
    if (i >= 0 && i < plugins.length) {
        console.log(header("Read metadata..."));
        const meta = require("." + PLUGIN_DIR + plugins[i] + "/plugin.js");
        console.log(header("Create archive..."));
        const archiveFile = TMP_DIR + meta.attributes.name + "-" + meta.attributes.version + ".zip";
        try {
            fs.removeSync(archiveFile);
        } catch(e) {
            e;
        }
        zipdir(PLUGIN_DIR + plugins[i], { saveTo: archiveFile }, (err) => {
            if (err) {
                console.log(error(err.message));
            } else {
                console.log(success("Archive done."));
                console.log(header("Uploading..."));

                request({
                    headers: {
                        "x-plugin-name": meta.attributes.name,
                        "x-plugin-version": meta.attributes.version,
                        "x-plugin-description": meta.attributes.description,
                        "x-plugin-category": meta.attributes.category,
                        "x-plugin-username": process.env.SMARTIES_USERNAME,
                        "x-plugin-token": process.env.SMARTIES_TOKEN,
                        "Content-Type": "multipart/form-data"
                    },
                    uri:PLUGINS_URL,
                    method: "POST",
                    formData : {
                    "plugin": fs.createReadStream(archiveFile)
                    }
                }, (err, resp, body) => {

                    if (err) {
                        console.log(error(err.message));
                        readline.close();
                    } else {
                        const r = JSON.parse(body);
                        if (r.hasOwnProperty(error) && !r.error) {
                            console.log(success("Upload done."));
                        } else {
                            console.log(error("Upload failed. : " + r.message));
                        }

                        readline.close();
                    }
                });
            }
            readline.close();
        });

    } else {
        console.log(error("Invalid selection"));

    }
});
