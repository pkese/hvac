
var Gpio = require('onoff').Gpio;
var rf = new Gpio(25, 'in', 'both');

var wpi = require('wiring-pi')
var PIN=25
wpi.setup('gpio');

var hrtime = process.hrtime;

module.exports = function(callback) {

  var Buffer = function(dim) {
    var buffer = new ArrayBuffer(dim*4);
    var items = new Int32Array(buffer);
    var pos = 0;
    for (var i=0; i<dim; i++) items[i]=0;

    return {
      push: function(x) {
        items[pos] = x;
        pos = (++pos) % dim;
      },
      reduce: function(fn, val) {
        for (var i=0; i<dim; i++) {
          val = fn(val, items[(pos+i)%dim], i);
        }
        return val;
      },
      toString: function() {
        var s = '';
        for (var i=0; i<dim; i++) {
          var val = items[(pos+i)%dim];
          s += ' '+val;
          if (val>3000) s += '\n'
        }
        return s + '\n';
      }
    }
  }
  var buffer = Buffer(512);

  var analyze = function() {
    //console.log(buffer.toString());
    var s = buffer.reduce(function(acc, cur, idx) {
      var acur = Math.abs(cur);
      if (acur>200000) return acc+'\n---\n';
      if (acur>2800) return (acc.length < 20) ? '' : acc+'\n';
      if (cur<500) return acc;
      if (cur>1500) return acc+'1';
      return acc+'0';
    }, '');
    //console.log(s);

    /* parse received data
    data:    1100010110 01 000011111101 1111 00101111 xxxx
    what:    addr       ch temp         xxxx humid    padding
    length:  10         2  12           4    8
    offset:  0          10 12           24   28       36
    */
    var rx = s.split('\n')
    // remove leading zeros if transmit is too long: each transmit starts with two consecutive ones
    //.map(function(s) {console.log('a',s); return s})
    /*
    .map(function(s) {
      while (s.length>36 && (s[0]!='1' || s[1]!='1')) s = s.substring(1);
      return s
    })
    */
    // need at least 38 (or 42 with 'trailing') bits
    .filter(function(s) {return s.length>=36})
    // truncate longer strings
    .map(function(s) {return s.substring(0,36)})
    // turn each string into vector of [+1,-1,...]
    .map(function(s) {
      return s.split('').map(function(c) {return c=='1'?1:(c=='0'?-1:0)})
    })
    //.map(function(s) {console.log(s); return s})
    // sum up receive vectors into a single vector
    .reduce(function(acc, val) {
      val.forEach(function(n,idx){acc[idx]+=n})
      return acc
    }, [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]) //es6: Array(36).fill(0)
    //.map(function(s) {console.log(''+s); return s})
    // turn back into a string of ones and zeros
    // put spaces into appropritate places
    .reduce(function(acc, bit, idx) {
      if (idx==10 || idx==12 || idx==24 || idx==28) acc += ' ';
      if (Math.abs(bit)<3) return acc+'?'; // make sure at least 3 values agree
      if (bit>0) return acc+'1'
      if (bit<0) return acc+'0'
    }, '')
    //console.log('received', rx, new Date())

    // process reception string & split it into temperature record ...
    var result = rx.split(' ')
    .map(function(s) {
      if (s.indexOf('?')>=0) return NaN;
      return parseInt(s,2); // convert binary string to integer
    })
    .reduce(function(acc, val, idx) {
      if (isNaN(val)) {
        acc.valid = false;
        return acc;
      }
      switch (idx) {
        case 0: acc.addr = val; break;
        case 1: acc.channel = val+1; break;
        case 2: acc.temp = val/10.0; break;
        case 3: /* sentinel */ break;
        case 4: acc.rh = val; break;
      }
      return acc;
    }, {valid:true})
    // set the 'updated' field only if all fields are filled in
    if (result.valid) result.updated = new Date();

    // console.log('parsed', result);
    callback(result);

    // resume interrupts
    startWatching();
  }

  var interruptHandler;
  var prevValue = 0;
  interruptHandler = function(err, value) {
    if (value == prevValue) {
      value = wpi.digitalRead(PIN);
      if (value == prevValue) return;
    }
    prevValue = value;

    var now = hrtime();
    var delta = hrtime(last);
    var usec = /*delta[0]*1000000 +*/ delta[1]/1000;

    //buffer.push( wpi.digitalRead(PIN) ? usec : -usec );
    buffer.push( value ? usec : -usec );
    if (usec > 250000) {
      rf.unwatch(interruptHandler);
      setTimeout(analyze, 0);
    }
    last = now;
    if (err) console.log('err', err);
  };

  function startWatching() {
    last = hrtime();
    prevValue = wpi.digitalRead(PIN)
    rf.watch(interruptHandler);
  }

  //console.log('listening');

  startWatching();

}
