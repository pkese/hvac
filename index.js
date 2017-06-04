"use strict"

const feathers = require('feathers');
const errors = require('feathers-errors');
const rest = require('feathers-rest');
const hooks = require('feathers-hooks');
const socketio = require('feathers-socketio');
const bodyParser = require('body-parser');
const _ = require('lodash');

const global_state = require('./state');

const controller = require('./controller');

//Basic-Auth config
const auth = require('basic-auth');

var app = feathers()
/*
credentials file should contain:
module.exports = {
  name: "something",
  pass: "something"
}
*/
const auth_credentials = require('./secret-credentials.js');

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

app.get('/', (req, res) => {
  req.socket.setNoDelay(true);
  var cookies = cookieAuth(req,res);
  var authorized = cookies.authorized();
  if (!authorized) {
    var credentials = auth(req)
    authorized = (credentials && credentials.name === auth_credentials.name && credentials.pass === auth_credentials.pass);
    cookies.authorize();
  }
  if (authorized) {
    res.sendFile('index.html', {root: __dirname+'/client'});
  } else {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="example"')
    res.end('Access denied')
  }
});

// serve static files in development mode
app.use((req, res, next) => {
  if (/.*\.js/.test(req.path)) {
    res.charset = "utf-8";
    req.url = req.url + '.gz';
    res.header('Content-Encoding', 'gzip');
    req.socket.setNoDelay(true);
  }
  next();
});
app.use( '/static', feathers.static(__dirname+'/client/build'));


function state_service() {
  const app = this;
  const state = {};
  let self = null;

  const getPatches = (src,dst) => Object.keys(dst)
    .reduce((result,key) => {
      if (!_.isEqual(src[key], dst[key])) result[key] = dst[key];
      return result;
    }, {})

  class StateService {
    setup(app,path) {
      self = app.service('state');
    };
    find() {
      //console.log('state::find');
      return Promise.resolve(Object.keys(state).map(key => Object.assign({},state[key],{id:key})));
    };
    get(key) {
      return Promise.resolve(Object.assign({},state[key],{id:key}));
    };
    update(key, data) {
      //console.log('update',key,data);
      const curr = state[key];
      if (typeof curr !== 'object') {
        self.patch(key,data); // notify listeners
      } else {
        const patch = getPatches(curr,data);
        //console.log({curr,data,patch});
        if (!_.isEmpty(patch)) self.patch(key,patch);
      }
      //return Promise.resolve(data);
    };
    patch(key, data) {
      //console.log('state::patch',key,data);

      if (key === 'rf-temp') {
        //console.log('got rf:', data)
        if (!data.channel || typeof data.temp != 'number' || data.temp < -30 || data.temp > 60)
          return
        if (typeof data.updated == 'string') data.updated = Date.parse(data.updated);
        const report_key = ['L1report','L0report','L2report'][data.channel-1];
        global_state[report_key] = data;
        //console.log('parsed as', data, 'into', report_key);
        controller.decide();
        //controller.refresh();

        return;
      }

      // parse settings & forward them to controller
      ['L0active','L1active','L0target_temp','L1target_temp'].forEach( name => {
        if (name in data) {
          const value = data[name];
          if (global_state[name] !== value) {
            console.log('set',name,':',global_state[name],'->',value);
            global_state[name] = value;
            controller.decide();
            controller.refresh();
          }
        }
      });

      let data_copy = Object.assign({},data);
      if (typeof state[key] !== 'object') { // set
        state[key] = data_copy; // shallow copy
      } else { // merge
        Object.assign(state[key],data)
      }
      // return the record to emit 'patched' notification
      data_copy.id = key;
      return Promise.resolve(data_copy);
    };
  }
  app.service('state', new StateService());
}


var MongoClient = require('mongodb').MongoClient;
var mongodb = require('feathers-mongodb');

//MongoClient
//.connect('mongodb://localhost:27017/hvac')
//.then(db => {
  app
    .configure(rest())
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .configure(hooks())
    .configure(socketio())
    .configure(state_service)
/*    
    .use('logs', mongodb({
      Model: db.collection('logs'),
      paginate: {
        default: 100,
        max: 500
      }
    }))
*/    
    .configure(controller)
    .listen(8080, function(){
      console.log('listening on *:8080');
    })
//});
