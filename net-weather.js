"use strict"

var URL = "http://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observationAms_LOGATEC_latest.xml"

var request = require('superagent');

request
  .get(URL)
  .type('xml')
  .buffer()
  .end(function(err, res){
    if (res.ok) {
      var xml = res.text;
      var result = {
        t: parseFloat(xml.match(/<t>(.+?)<\/t>/)[1]),
        rh: parseFloat(xml.match(/<rh>(.+?)<\/rh>/)[1]),
        tavg: parseFloat(xml.match(/<tavg>(.+?)<\/tavg>/)[1]),
        rhavg: parseFloat(xml.match(/<rhavg>(.+?)<\/rhavg>/)[1]),
        updated: new Date(xml.match(/<tsValid_issued_RFC822>(.+?)<\/tsValid_issued_RFC822>/)[1]),
      }
      console.log(result);
    } else {
      console.log('meteorological station error...', res.text)
      return;
    }
  });
