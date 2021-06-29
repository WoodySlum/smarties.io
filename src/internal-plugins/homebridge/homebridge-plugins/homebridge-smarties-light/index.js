/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-light", "Smarties light sensor", SmartiesLightAccessory);
}

function SmartiesLightAccessory(log, config) {
  this.log = log;
  this.service = new Service.LightSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
    .on('get', this.handleCurrentAmbientLightLevelGet.bind(this));
}

  SmartiesLightAccessory.prototype.handleCurrentAmbientLightLevelGet = function(callback) {
      let called = false;
      const securityProcess = setTimeout(() => {
          called = true;
          callback(null);
      }, constants.TIMER_SECURITY_S);
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res.value == 0) {
                      if (!called) callback(null, 0.0001);
                  } else {
                      if (!called) callback(null, data.res.value);
                  }
                  clearTimeout(securityProcess);
              } else {
                  if (!called) callback(Error("Invalid value"));
                  clearTimeout(securityProcess);
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesLightAccessory.prototype.getServices = function() {
  return [this.service];
}
