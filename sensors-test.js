
var sensors = require("./sensors")

var print_sensors = function() {
  console.log('');
  for (var name in sensors) {
      var sensor = sensors[name];
      if (typeof sensor.temp == 'number')
	  console.log(sensor.id, sensor.temp.toFixed(2), (sensor.delta>=0?'+':'')+(sensor.delta*60).toFixed(2), name); 
  }
}

var test_sensors = function() {
  sensors._fetch_all().then(print_sensors);
}

setInterval(test_sensors, 5000);
