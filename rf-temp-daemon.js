
var temp_receiver = require('./rf-temp-receiver')

var socket = require('socket.io-client')("http://localhost", {reconnectionDelayMax:5000000})

temp_receiver(function(data) {
  //console.log(data);
  socket.emit('state::update','rf-temp', data);
})

var heartbeat = (function() {
  var timeout = null;
  return function() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(function() {
      console.log('Temperature RF receiver deamon terminating due to lack of HVAC communication.')
      process.exit(1);
    }, 5*60*1000)
  }
})()

socket.on('state updated', function(data) {
  //console.log('peer is alive', data);
  heartbeat();
});
