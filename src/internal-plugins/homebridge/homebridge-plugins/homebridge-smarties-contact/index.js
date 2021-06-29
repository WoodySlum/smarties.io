/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-contact", "Smarties contact sensor", SmartiesContactAccessory);
}

function SmartiesContactAccessory(log, config) {
  this.log = log;
  this.service = new Service.ContactSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.ContactSensorState)
    .on('get', this.handleContactSensorStateGet.bind(this));
}

  SmartiesContactAccessory.prototype.handleContactSensorStateGet = function(callback) {
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
                      if (!called) callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
                  } else {
                      if (!called) callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
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



SmartiesContactAccessory.prototype.getServices = function() {
  return [this.service];
}
