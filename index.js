"use strict"

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var state = require('./state');

var controller = require('./controller')

//Basic-Auth config
var auth = require('basic-auth');

/*
credentials file should contain:
module.exports = {
  name: "something",
  pass: "something"
}
*/
var auth_credentials = require('secret-credentials.js')

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

app.get('/', function(req, res){
  var credentials = auth(req)
  if (!credentials || credentials.name !== auth_credentials.name || credentials.pass !== auth_credentials.pass) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="example"')
    res.end('Access denied')
  } else {
    res.sendfile('index.html');
  }
});

app.get('/app.jsx', function(req, res){
  res.sendfile('client.js');
});

io.on('connection', function (socket) {
  if (data) socket.emit('data', data);
  socket.on('active', function (active) {
    console.log('io.active', active);
    state.active = active;
    controller.decide();
    controller.refresh();
  });
  socket.on('temp', function (temp) {
    console.log('io.temp', temp);
    state.target_temp = temp;
    controller.decide();
    controller.refresh();
  });
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

http.listen(80, function(){
  console.log('listening on *:80');
});

function onControllerUpdate(_data) {
  data = _data;
  io.emit('data', data)
}

controller(onControllerUpdate)
