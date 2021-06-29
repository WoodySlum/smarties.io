/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-smoke", "Smarties smoke sensor", SmartiesSmokeAccessory);
}

function SmartiesSmokeAccessory(log, config) {
  this.log = log;
  this.service = new Service.SmokeSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.SmokeDetected)
    .on('get', this.handleSmokeDetectedGet.bind(this));
}

  SmartiesSmokeAccessory.prototype.handleSmokeDetectedGet = function(callback) {
      let called = false;
      const securityProcess = setTimeout(() => {
          called = true;
          callback(null);
      }, constants.TIMER_SECURITY_S);
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.tValue != null && data.tValue > 0) {
                      if (!called) callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
                  } else {
                      if (!called) callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
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



SmartiesSmokeAccessory.prototype.getServices = function() {
  return [this.service];
}
