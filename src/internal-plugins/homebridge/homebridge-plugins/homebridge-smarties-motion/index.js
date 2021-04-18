/* eslint-disable */
var Service, Characteristic, Api;

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
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res > 0) {
                      callback(null, 1);
                  } else {
                      callback(null, 0);
                  }

              } else {
                  callback(Error("Invalid value"));
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesMotionAccessory.prototype.getServices = function() {
  return [this.service];
}
