/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-motion", "Smarties motion sensor", SmartiesMotionAccessory);
}

function SmartiesMotionAccessory(log, config) {
  this.log = log;
  this.service = new Service.MotionSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.MotionDetected)
    .on('get', this.handleMotionDetectedGet.bind(this));
}

  SmartiesMotionAccessory.prototype.handleMotionDetectedGet = function(callback) {
      let called = false;
      const securityProcess = setTimeout(() => {
          called = true;
          callback(null);
      }, constants.TIMER_SECURITY_S);
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res > 0) {
                      if (!called) callback(null, 1);
                  } else {
                      if (!called) callback(null, 0);
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



SmartiesMotionAccessory.prototype.getServices = function() {
  return [this.service];
}
