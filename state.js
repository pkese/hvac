
MODES = {
    _FIRST:1,
    DAY:1,
    NIGHT:2,
    AWAY:3,
    _LAST:3,
    MANUAL:4,
    POWEROFF:5,
},

MODE_NAMES = {
    1: "aktivni",
    2: "spimo",
    3: "odsotni",
    4: "ROCNO DELOVANJE",
    5: "IZKLOP!!!",
}

state = {
  mode: 3,
  target_temp: 0,
}

module.exports = {
    state: state,
    MODES: MODES,
    MODE_NAMES: MODE_NAMES,
};