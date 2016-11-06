"use strict"

var feathers = require('feathers');
var socketio = require('feathers-socketio')

var state = require('./state');

var controller = require('./controller')

//Basic-Auth config
var auth = require('basic-auth');

var app = feathers()

/*
credentials file should contain:
module.exports = {
  name: "something",
  pass: "something"
}
*/
var auth_credentials = require('./secret-credentials.js')

// Object.extend (aka assign) polyfill for Node 0.12
Object.defineProperty(Object.prototype, "extend", {
    enumerable: false,
    value: function(from) {
        var props = Object.getOwnPropertyNames(from);
        var dest = this;
        props.forEach(function(name) {
          dest[name] = from[name];
        });
        return this;
    }
});

var data = null;

var crypto = require('crypto')
var Cookies = require('cookies');
var cookieAuth = function(req, res) {
  var cookies = Cookies(req, res);
  var auth = cookies.get('auth');
  // calculate SHA1 of ua + password string
  var sha = crypto.createHash('sha1');
  sha.update(req.headers['user-agent']);
  sha.update(auth_credentials.name + auth_credentials.pass);
  var authstr = sha.digest('hex');
  //console.log('cookie', auth, authstr, req.headers['user-agent']);
  return {
    authorized: function() {return auth == authstr;},
    authorize: function() {cookies.set('auth',authstr, {maxAge: 9007199254740991});}
  };
}

app.get('/', function(req, res){
  var cookies = cookieAuth(req,res);
  var authorized = cookies.authorized();
  if (!authorized) {
    var credentials = auth(req)
    authorized = (credentials && credentials.name === auth_credentials.name && credentials.pass === auth_credentials.pass);
    cookies.authorize();
  }
  if (authorized) {
    res.sendFile('index.html', {root: __dirname});
  } else {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="example"')
    res.end('Access denied')
  }
});

app.configure(socketio(function(io) {
  io.on('connection', function (socket) {
    if (data) socket.emit('data', data);
    let setHandler = propname => {
      socket.on(propname, value => {
        console.log("socket.io:", propname, "=", value);
        state[propname] = value;
        controller.decide();
        controller.refresh();
      });
    }
    ['L0active','L1active','L0target_temp','L1target_temp'].forEach(setHandler);

    socket.on('rf-temp', function(data) {
      //console.log('got rf:', data)
      if (!data.channel || typeof data.temp != 'number')
        return
      var target = [state.L1report,state.L0report,state.L2report][data.channel-1];
      if (typeof data.updated == 'string') data.updated = Date.parse(data.updated);
      // Object.assign(target, data);
      target.extend(data);
      //console.log('parsed as', data, 'into', target);
      controller.decide();
      //controller.refresh();
    });
  });
  
  // dispatch data update to socketio listeners...
  function onControllerUpdate(_data) {
    data = _data;
    io.emit('data', data)
  }

  // initialize the controller
  controller(onControllerUpdate)

}))

app.listen(80, function(){
  console.log('listening on *:80');
});

