"use strict"

const feathers = require('feathers');
const errors = require('feathers-errors');
const rest = require('feathers-rest');
const hooks = require('feathers-hooks');
const socketio = require('feathers-socketio');

const state = require('./state');

const controller = require('./controller');

//Basic-Auth config
const auth = require('basic-auth');

var app = feathers()
  .configure(rest())
  .configure(hooks())
  .configure(socketio())

/*
credentials file should contain:
module.exports = {
  name: "something",
  pass: "something"
}
*/
const auth_credentials = require('./secret-credentials.js');

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

var state_service = {
  find(params) {
    console.log('state find');
    return Promise.resolve(data);
  },
  create(_data) {
    //console.log('new state created');
    data = _data;
    return Promise.resolve(data);
  },
  update(key,data) {
    //console.log('state::update',key,data);
    if (['L0active','L1active','L0target_temp','L1target_temp'].includes(key)) {
      const {value} = data;
      if (state[key] !== value) {
        console.log('set',key,':',state[key],'->',value);
        state[key] = value;
        controller.decide();
        controller.refresh();
      }
    } else if (key === 'rf-temp') {
      //console.log('got rf:', data)
      if (!data.channel || typeof data.temp != 'number')
        return
      var target = [state.L1report,state.L0report,state.L2report][data.channel-1];
      if (typeof data.updated == 'string') data.updated = Date.parse(data.updated);
      // Object.assign(target, data);
      Object.assign(target,data);
      //console.log('parsed as', data, 'into', target);
      controller.decide();
      //controller.refresh();
    } else {
      return new errors.NotFound('Invalid control key "{key}"');
    }
  },
}

app
  .use('state', state_service)
  .configure(controller)
  .listen(80, function(){
    console.log('listening on *:80');
  })
