/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-humidity", "Smarties humidity sensor", SmartiesHumidityAccessory);
}

function SmartiesHumidityAccessory(log, config) {
  this.log = log;

  this.service = new Service.HumiditySensor(this.name);

  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on('get', this.getHumidity.bind(this))
    .setProps({ minValue: 0 , maxValue: 100});
}

SmartiesHumidityAccessory.prototype.getHumidity = function(callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.sensor == this.identifier) {
            Api.removeListener("getValueRes", cb);
            if (!data.err && data.res) {
                if (!called) callback(null, parseFloat(data.res.value));
            } else {
                if (!called) callback(Error("Invalid value"));
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getValueRes", cb);
    Api.emit("getValue", this.identifier);
}


SmartiesHumidityAccessory.prototype.getServices = function() {
  return [this.service];
}
