"use strict"

var relays = {
  L1_pump: 22,
  L0_pump: 23,
  boiler_pump: 24,
  unused1: 26,
  mixer_up: 25,
  mixer_down: 27,
  unused2: 28,
  unused3: 29,
  //_blink_all: function()
  //_signal_all: function()
};
module.exports = relays;

var wpi = require('wiring-pi')
wpi.setup('wpi')

var Relay = function(pin) {
  var value = 0;

  wpi.pinMode(pin, wpi.INPUT);
  wpi.pullUpDnControl(pin, wpi.PUD_OFF);

  var result = {
    get: function() {return value;},
    set: function(val) {
      val = val ? 1 : 0;
      if (val != value) {
        if (val) {
          wpi.pinMode(pin, wpi.OUTPUT);
          wpi.digitalWrite(pin, wpi.LOW);
        } else {
          wpi.pinMode(pin, wpi.INPUT);
        }
        value = val;
      };
    },
    blink: function(duration, delay) {
      delay = delay || 0;
      setTimeout(function() {
        wpi.pullUpDnControl(pin, wpi.PUD_DOWN);
        setTimeout(function(){wpi.pullUpDnControl(pin, wpi.PUD_OFF)}, duration);
      }, delay);
    },
    signal: function(val) {
      wpi.pullUpDnControl(pin, val ? wpi.PUD_DOWN : wpi.PUD_OFF);
    },
  }
  result.on = function() {result.set(1)};
  result.off = function() {result.set(0)};
  result.turn = result.set;
  return result
};

// initialize
var all_relays = [];
for (var name in relays) {
  var relay = Relay(relays[name]);
  relays[name] = relay;
  all_relays.push(relay);
}

relays._blink_all = function() {
  for (var i=0; i<all_relays.length; i++) {
    all_relays[i].blink(300,100*i);
  }
}
relays._signal_all = function(val) {
  for (var i=0; i<all_relays.length; i++) {
    all_relays[i].signal(val);
  }
}
