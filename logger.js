
const _ = require('lodash');

const LogCollector = (log_service) => {
  const MINUTES = 60*1000;
  const REPORT_EVERY = 5 * MINUTES;

  let report_due = Date.now();
  let start_time = 0;
  let last_time = 0;
  let temps_acc = {};
  let state_acc = {};
  let state_old = {};


  const log_data = (timestamp, duration, temps_acc, state_acc, state_old) => {
    let rec = Object.assign({ts:timestamp,dur:duration,uptime:process.uptime()},state_old);
    Object.keys(state_acc).forEach( key => rec[key] = state_acc[key] / duration * 1000);
    Object.keys(temps_acc).forEach( key => rec[key] = temps_acc[key] / duration * 1000);
    //console.log(rec);
    log_service.create(rec);
  }

  const reset = (state, temps, _timestamp) => {
    Object.keys(temps).forEach( key => temps_acc[key] = 0 );

    ['L0','L1','L2','Boiler'].forEach( Name => {
      if (`${Name}target_temp` in state) {
        state_acc[`${Name}target`] = 0;
      }
      const rf = state[`${Name}report`];
      if (rf && rf.valid && typeof rf.temp == 'number' && (Date.now() - rf.updated < 15*60*1000)) {
        state_acc[`${Name}temp`] = 0;
        state_acc[`${Name}rh`] = 0;
      }
      if (`${Name}active` in state)
        state_old[`${Name}active`] = state[`${Name}active`] ? 1 : 0;
      if (`heat${Name}` in state)
        state_old[`${Name}run`] = state[`heat${Name}`] ? 1 : 0;
    });

    start_time = last_time = _timestamp || Date.now();
  }

  const put = (state, temps) => {
    let flush = false;
    const now = Date.now();
    const dur = (now - last_time) * 0.001;

    Object.keys(temps).forEach( key => {
      if (key in temps_acc) {
        temps_acc[key] += temps[key] * dur;
      } else {
        flush = true;
      }
    });

    const state_new = {};
    ['L0','L1','L2','Boiler'].forEach( Name => {
      if (`${Name}target_temp` in state) {
        state_acc[`${Name}target`] += state[`${Name}target_temp`] * dur;
      }
      const rf = state[`${Name}report`];
      if (rf && rf.valid && typeof rf.temp == 'number' && (now - rf.updated < 15*60*1000)) {
        flush |= !(`${Name}temp` in state_acc);
        state_acc[`${Name}temp`] += rf.temp * dur;
        state_acc[`${Name}rh`] += rf.rh * dur;
      } else {
        flush |= (`${Name}temp` in state_acc);
      }
      if (`${Name}active` in state)
        state_new[`${Name}active`] = state[`${Name}active`] ? 1 : 0;
      if (`heat${Name}` in state)
        state_new[`${Name}run`] = state[`heat${Name}`] ? 1 : 0;
    }) 

    if (now >= report_due || flush || !_.isEqual(state_old, state_new)) {
      log_data(start_time, now-start_time, temps_acc, state_acc, state_old);
      reset(state,temps,now);
      initial = false;

      report_due = (~~(now / REPORT_EVERY)+1) * REPORT_EVERY;
    }

    last_time = now;
  }
  return {
    init: reset,
    put
  }
}

module.exports = LogCollector;

