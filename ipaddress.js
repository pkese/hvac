

let address = 'resolving'

const ip = require('whatismyip');

var options = {
  url: 'http://checkip.dyndns.org/',
  truncate: '',
  timeout: 60000,
  matchIndex: 0
};

ip.whatismyip(options, function(err, data){
  if (err === null) { 
  /*
    { url: 'http://checkip.dyndns.org/',
    truncate: '',
    timeout: 60000,
    matchIndex: 0,
    time: 1496560225648,
    ip: '84.41.54.171' }
  */
    address = data.ip + ':4444'
  } else {
    address = "";
  }
  console.log("ip address:", address);
});

module.exports = () => address;
