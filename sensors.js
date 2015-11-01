"use strict"
var ds18b20 = require('ds18b20')

// a registry of all known sensors
var known_sensors = {}

var Sensor = function(id) {
  var result = {
    id: id,
    temp: undefined,
    err: undefined,
    delta: 0,
  }
  var updated = null;

  result.update = function() {
    return new Promise(function(resolve, reject) {
      ds18b20.temperature(id, function(err, _temp) {
        //console.log("temp callback",id, err, _temp);
        /*
        if (err) {
          result.temp = undefined;
          reject(err);
        } else {
          result.temp = _temp;
          resolve(_temp);
        } 
        */
        if (err) {
          result.err = err;
        } else {
          // calculate delta temperature
          var now = new Date();
          if (updated !== null) {
            var dt = now - updated;
            var delta = (_temp - result.temp) / (now - updated) * 1000;
            result.delta = (result.delta / 2) + delta;
          }
          updated = now;
          // update result
          result.temp = _temp;
        }  
        resolve(_temp);
      });
    });
  }
  known_sensors[id] = result;
  return result;
}

var sensors = {
  stove: Sensor("28-000007373432"),
  hot: Sensor("28-000007377c5c"),
  cold: Sensor("28-000007375067"),

  cont1: Sensor("28-00000736b574"), // top of container
  cont2: Sensor("28-00000727206a"),
  cont3: Sensor("28-00000737c0d6"),
  cont4: Sensor("28-00000737b69c"), // bottom

  L1_room: Sensor("28-0000073740b8"), // distribution box frame
  L1_dist: Sensor("28-00000736ca13"), // inside distribution box
  L1_floor: Sensor("28-00000736d729"),
  L1_pump: Sensor("28-00000727c820"),
  L1_ret: Sensor("28-000007372be7"),
  //L0_room:  Sensor("") , (tbd)
  L0_pump: Sensor("28-0000073704f2"),
  L0_ret: Sensor("28-00000736b1e3"),
  boiler: Sensor("28-000007374b1e"),
  boiler_ret: Sensor("28-00000737784b"),
  //outside: Sensor(""),
  aux: Sensor("28-0014150bf8ff"),

}

// add additional detected but undefined sensors to the list
var other_sensors = ds18b20.sensors(function(err, ids) {
  for (var id of ids) {
    if (!known_sensors.hasOwnProperty(id)) sensors[id] = Sensor(id);
   }
})

sensors._fetch_all = function() {
  var promises = [];
  for (var id in known_sensors) promises.push(known_sensors[id].update());
  return Promise.all(promises);
}

module.exports = sensors;
