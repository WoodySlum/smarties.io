/* eslint-disable */
var Service, Characteristic, Api;

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
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res == 0) {
                      callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
                  } else {
                      callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
                  }

              } else {
                  callback(Error("Invalid value"));
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesContactAccessory.prototype.getServices = function() {
  return [this.service];
}
