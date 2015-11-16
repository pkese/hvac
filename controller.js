"use strict"

var wpi = require('wiring-pi')
var LCD = require('./i2c-lcd')

/*
var watchdog = require("pi-watchdog")();
watchdog.setTimeout(45, function(err, timeout) {
    console.log('watchdog timeout set to '+timeout.toFixed(2)+'s');
})
*/

var sensors = require('./sensors')
var relays = require('./relays')
var state = require('./state')

// initialize here

relays._signal_all(1);

/* GPIO pin config (wiring pi)
15 = modeswitch
16 = manual
1 = up
5 = down
6 = radio ASK input
29,28,27,25,26,24,23,22 = relays
*/

wpi.pinMode(6, wpi.INPUT);

var refresh = function() {console.log('pre-refresh')}; // forward declaration of function to refresh display
var netUpdate = function() {} // update socketio placeholder

var button = function(pin, callback) {
    wpi.pinMode(pin, wpi.INPUT);
    wpi.pullUpDnControl(pin, wpi.PUD_UP);
    var debounce = null;
    wpi.wiringPiISR(pin, wpi.INT_EDGE_FALLING, function(delta) {
      //console.log("Pin", pin, " changed to LOW (", delta, ")");
      if (debounce) return;
      debounce = setTimeout( function() {debounce=null;}, 200);
      setTimeout( function() {
        // ripple rejection (check if value is the same after some time)
        if (wpi.digitalRead(pin) == 0) callback(delta);
      }, 100);
    });
}

var checkManualMode = function() {
  return (wpi.digitalRead(16)==0);
}

var system_poweroff = function() {
  relays._signal_all(1);
  state.active = false;
  refresh();
  lcd.off();
  lcdPromise = lcdPromise.then(function() {
    return lcd.home();
  }).then(function() {
    require('child_process').spawn('/sbin/poweroff');

    // disable radio receiver LED
    wpi.setValue(6, wpi.HIGH);
    wpi.pinMode(6, wpi.OUTPUT);

    while(1); // endless loop
  })
}
// modeswitch
button(15, function(delta) {
  if (checkManualMode()) {
    // debounce then POWEROFF
    setTimeout(function() {
      if (checkManualMode() && wpi.digitalRead(15) == 0) system_poweroff();
    }, 400);
  } else {
    state.active = !state.active;
    refresh();
  }
})

// up
button(1, function(delta) {
    //console.log('up');
    state.target_temp += 0.5;
    refresh();
})

// down
button(5, function(delta) {
    //console.log('down');
    state.target_temp -= 0.5;
    refresh();
})

/*
display:
+--------------------+
|cur tla za/lo/godc
| <doma>   21.5dc
|
|192.168.1.245  21:44|


| <spanje> 18.0 dc
*/

let lcd = new LCD();
let lcdPromise = lcd.init();
/*
function testLCD() {
    lcd.then(function() {
      return lcd.createChar(0, [0x1b, 0x15, 0x0e, 0x1b, 0x15, 0x1b, 0x15, 0x0e]);
    }).then(function() {
      return lcd.createChar(1, [0x0c, 0x12, 0x12, 0x0c, 0x00, 0x00, 0x00, 0x00]);
    }).then(function() {
      return lcd.home();
    }).then(function() {
      return lcd.print("Raspberry Pi " + (String.fromCharCode(0)));
    }).then(function() {
      return lcd.setCursor(0, 1);
    }).then(function() {
      return lcd.cursorUnder();
    }).delay(4000).then(function() {
      var d, s;
      d = new Date();
      s = d.toString();
      return lcd.setCursor(0, 0).then(function() {
        return lcd.print(s);
      }).then(function() {
        return lcd.setCursor(0, 1);
      }).then(function() {
        return lcd.print(s.substring(16));
      });
    }).delay(4000).then(function() {
      return lcd.off();
    }).done();
}
*/

function getContainerPercent() {
  let contsum = sensors.cont1.temp + sensors.cont2.temp + sensors.cont3.temp + sensors.cont4.temp;
  let percent = (contsum-88)/(285-88)*100;
  if (percent < 0) percent = 0;
  return percent;
}

refresh = function() {
    //console.log('refresh');
    netUpdate()
    lcdPromise = lcdPromise.then(function() {
      return lcd.home();
    }).then(function() {
      //if (sensors.aux.temp != 'undefined') ...
      let percent = getContainerPercent();
      let s = '';
      //s += sensors.aux.temp.toFixed(1);
      s += L1TempEstimator.get().toFixed(1);
      s += ' ' + sensors.cont1.temp.toFixed(0);
      s += '/' + ((sensors.cont2.temp + sensors.cont3.temp)/2.0).toFixed(0);
      s += '/' + sensors.cont4.temp.toFixed(0);
      s += String.fromCharCode(0xdf)+" ";
      s += percent.toFixed(1) + "%  ";
      return lcd.print(s)
    }).then(function() {
      return lcd.setCursor(0,1);
    }).then(function() {
      return lcd.print("");
    }).then(function() {
      return lcd.setCursor(0,2);
    }).then(function() {
      if (checkManualMode()) {
        return lcd.print("   ROCNO DELOVANJE     ");
      } else {
        var s = "Nacin: ";
        if (state.active) {
          s += "gretje "+state.target_temp.toFixed(1)+String.fromCharCode(0xdf)+"C ";
        } else {
          s += "neaktivno     "
        }
        return lcd.print(s);
      }
    }).then(function() {
      return lcd.setCursor(0,3);
    }).then(function() {
      if (checkManualMode()) {
        return lcd.print("  [nacin] za izklop");
      } else {
        return lcd.print("                    ");
      }

    //}).then(function() {
    })
    return lcdPromise;
}

function MixerValve(up_relay, down_relay) {
  var currentDir = 0;
  var turningSince = new Date();
  var result = {}
  result.turn = function(dir) {
    if (dir > 0) dir = 1;
    else if (dir < 0) dir = -1;
    if (dir != currentDir) {
      up_relay.set(dir>0);
      down_relay.set(dir<0);
      currentDir = dir;
      turningSince = new Date();
      setTimeout(function(){result.turn(currentDir)}, 3.65*60*1000+1); // make sure to turn it off
    } else if (new Date() - turningSince > 3.65*60*1000) { // 3.5 minutes end-to-end by spec
      up_relay.set(0);
      down_relay.set(0);
    }
  }
  return result;
}
var mixerValve = MixerValve(relays.mixer_up, relays.mixer_down);
if (!checkManualMode()) mixerValve.turn(1);

function Heating(pump, mixerValve, out, ret, hot) {
  var current = false;
  var levelTimeout = null;
  var levelCmd = ''; // down / level / up
  var levelCronTimeout = null;
  var levelFunc = function() {
  }
  var result = {}
  result.levelOut = function() {
    var levelTurnHot = function() {
      console.log('levelOut post-turn');
      pump.off();
      mixerValve.turn(1);
      levelTimeout = null;
      if (hot.temp > 30 || ret.temp > state.target_temp+2) {
        var wakeupTimeoutHrs;
        if (hot.temp > 60) wakeupTimeoutHrs = 0.5;
        else if (hot.temp > 50) wakeupTimeoutHrs = 1;
        else if (hot.temp > 40) wakeupTimeoutHrs = 2;
        else wakeupTimeoutHrs = 4;
        levelCronTimeout = setTimeout(result.levelOut, wakeupTimeoutHrs*3600*1000);
      }
    }
    var levelLevelOut = function() {
      console.log('levelOut level');
      pump.on(); levelTimeout = setTimeout(levelTurnHot, 4*60*1000);
    }
    // turn cold & set timeout
    result.levelCancel();
    mixerValve.turn(-1);
    levelTimeout = setTimeout(levelLevelOut, 3.65*60*1000);
    console.log('levelOut pre-turn');
  },
  result.levelCancel = function() {
    if (levelTimeout) {
      clearTimeout(levelTimeout);
      levelTimeout = null;
    }
    if (levelCronTimeout) {
      clearTimeout(levelCronTimeout);
      levelCronTimeout = null;
    }
  }
  result.set = function(heat) {
    heat = !!heat; // boolean

    if (heat) {
      var proj_temp = out.temp + out.delta * 15 + ret.delta * 15 + hot.delta * 15;
      var req_temp = 32.5 + (32.5-ret.temp);
      if (proj_temp > req_temp+3) mixerValve.turn(-1)
      else if (proj_temp < req_temp-3) mixerValve.turn(1);
      else mixerValve.turn(0);
    }

    if (current==heat) // break on no-change
      return;

    current = heat;
    if (heat) {
      pump.on();
      result.levelCancel();
    } else {
      result.levelOut();
    }
  }
  result.busy = function() {return current || levelTimeout}
  levelCronTimeout = setTimeout(result.levelOut, 15*60*1000);
  return result;
}
var L1Heating = Heating(relays.L1_pump, mixerValve, sensors.L1_pump, sensors.L1_ret, sensors.hot);


var L1TempEstimator = (function() {
  let T_box = 0;
  let T_frame = 0;

  return {
    init: function() {
      T_box = sensors.L1_dist.temp;
      T_frame = sensors.L1_room.temp;
    },
    update: function() {
      T_box = (T_box * (90*60/4) - T_box + sensors.L1_dist.temp) / (90*60/4);
      T_frame = sensors.L1_room.temp;
    },
    get: function() {
      if (state.L1report.temp && (Date.now() - state.L1report.updated < 15*60*1000)) {
        return state.L1report.temp;
      } else {
        var temp = T_box - (T_box-T_frame)*2.12;
        var floor = sensors.L1_floor.temp;
        var fix = (floor-23)*0.25; // adjust per floor temp (neutral at 23 deg)
        return temp + fix;
      }
    },
  }
})();

function decide() {
  var target = state.active ? state.target_temp : 4.0; // 4 deg when not active (defrost)
  var supply = Math.max(sensors.hot.temp, sensors.cont1.temp-1);
  var overheat = (sensors.stove.temp > 76 || sensors.cont1.temp > 81) && (sensors.cold.temp > 68);
  state.overheat = overheat;

  // B o i l e r
  if ( // turn on boiler circulation if ...
    sensors.stove.temp > 55 // stove is hot
    && sensors.boiler.temp < 50 // heat boiler only to 50 deg
    && sensors.boiler.temp < supply - 5 // supply water is hot enough
    && sensors.boiler_ret.temp < supply - 10 // there is enough temperature difference through boiler
    ||
    overheat && sensors.boiler_ret.temp < 68 // while return water is not too hot in overheat mode
  ) {
    state.heatBoiler = true;
    relays.boiler_pump.on();
  } else if (
    !overheat &&
    ( sensors.stove.temp < 54 // stove is not hot
      || sensors.boiler.temp > 51 // boiler is warm enough
      || sensors.boiler.temp > supply - 4 // supply water too cold
      || sensors.boiler_ret.temp > supply - 5 // not enough temperature difference through boiler
    )
    || sensors.boiler_ret.temp > 70 // return water is too hot in overheat mode (+ prevent Legionnaires' disease)
  ) {
    state.heatBoiler = false;
    relays.boiler_pump.off();
  }

  // L e v e l - 0
  if (overheat) {
    state.heatL0 = sensors.L0_ret.temp < 60 || sensors.L0_pump.temp < 60
    relays.L0_pump.set(heatL0);
  } else {
    relays.L0_pump.off();
    state.heatL0 = false;
  }

  // L e v e l - 1
  if (supply > target+2 || supply > sensors.L1_floor.temp + 2 || sensors.stove.temp > 55 || overheat) {

    var t_room = L1TempEstimator.get();

    if (t_room < target || overheat) {
      if (!relays.L1_pump.get()) console.log('L1 on', target, t_room, sensors.L1_floor.temp)
      L1Heating.set(1);
      state.heatL1 = true;
    } else if (t_room > target+0.5) {
      //if (relays.L1_pump.get()) console.log('L1 off', target, t_room, sensors.L1_floor.temp)
      L1Heating.set(0);
      state.heatL1 = false;
    }
  } else {
  // off mode or cold water
    L1Heating.set(0);
    state.heatL1 = false;
  }
}

var doNetUpdate = function(callback) {
  return function() {
    let temps = {};
    for (var name in sensors) {
      var sensor = sensors[name];
      if (typeof sensor.temp == 'number') {
        temps[name] = {t: sensor.temp, d: sensor.delta}
      }
    }
    temps.L1_estimate = {t: L1TempEstimator.get()}
    callback({
      temps:temps,
      state:state,
      container: getContainerPercent(),
    });
  }
};

var controller = function(on_update) {

  netUpdate = doNetUpdate(on_update);

  var process_loop = 0;
  function process() {

    if (process_loop++ % 4 != 0)
      return;

    sensors._fetch_all()
    .then(function() {
      try {
        L1TempEstimator.update();
        decide();
        refresh()
        relays._blink_all();
      } catch (x) {
        console.log(x);
        console.log(x.stack);
      }

      /*
      fs = require('fs');
      fs.writeFile("/dev/watchdog",'1',{flag:"w+"}, function(err) {
          console.log('unable to update watchdog', err);
      })
      */
    });
  }

  sensors._fetch_all().then(function() {
    L1TempEstimator.init();
    console.log('initialized (T='+L1TempEstimator.get().toFixed(2)+')');
    refresh();
    process();
    setInterval(process, 1000);
  })
}

controller.refresh = refresh;
controller.decide = decide;
module.exports = controller;
