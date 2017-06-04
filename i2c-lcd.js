
// copied from https://github.com/sweetpi/i2c-lcd

const Promise = require('bluebird');
const i2c_bus = require('i2c-bus');
const assert = require('assert');

const displayPorts = {
  RS: 0x01,
  E: 0x04,
  backlight: 0x08,

  D4: 0x10,
  D5: 0x20,
  D6: 0x40,
  D7: 0x80,

  CHR: 1,
  CMD: 0,

  RW: 0x20
};

const I2C = (address, busnum) => {
  let bus = i2c_bus.openSync(1);
  return {
    writeByteAsync: x => new Promise( (resolve, reject) => {
      bus.sendByte(address, x, err => {
        if (err) {console.log('err',err); reject(err);}
        else resolve();
      });
    }),
  }
}

const LCD = (busnum = 1, address = 0x27) => {
  
  const i2c = I2C(address, busnum);

  function write4(x, c) {
    const a = x & 0xf0 | displayPorts.backlight | c;
    return Promise.resolve()
    .then(() => i2c.writeByteAsync(a))
    //.delay(1)
    .then(() => i2c.writeByteAsync(a | displayPorts.E))
    .then(() => i2c.writeByteAsync(a))
  }

  function write(x, c) {
    return Promise.resolve()
    .then(() => write4(x, c))
    .then(() => write4(x << 4, c))
  }

  return {
    /**
    intialize the display
     */
    init: () => {
      return Promise.resolve()
      .then(() => write4(0x30, displayPorts.CMD))
      .then(() => write4(0x30, displayPorts.CMD))
      .then(() => write4(0x30, displayPorts.CMD))
      .then(() => write4(LCD.FUNCTIONSET | LCD._4BITMODE | LCD._2LINE | LCD._5x10DOTS, displayPorts.CMD))
      .then(() => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON, displayPorts.CMD))
      .then(() => write(LCD.ENTRYMODESET | LCD.ENTRYLEFT, displayPorts.CMD))
      .then(() => write(LCD.CLEARDISPLAY, displayPorts.CMD))
      .delay(200);
    },
    
    /**
    write text at current cursor position
    */
    print: str => {
      assert(typeof str === "string");
      return Promise.each(str.split(''), ch => write(ch.charCodeAt(0), displayPorts.CHR));
    },
 
    clear: () => write(LCD.CLEARDISPLAY, displayPorts.CMD),
    
     /**
    flashing block for the current cursor
     */
    cursorFull: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSORON | LCD.BLINKON, displayPorts.CMD),
 
    /**
    small line under the current cursor
     */
    cursorUnder: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSORON | LCD.BLINKOFF, displayPorts.CMD),

    /**
    set cursor to 0,0
     */
    home: () => write(LCD.SETDDRAMADDR | 0*0, displayPorts.CMD),

    /**
    set cursor pos, top left = 0,0
     */
    setCursor: (x, y) => {
      assert(typeof x === "number");
      assert(typeof y === "number");
      assert(0 <= y && y <= 3);
      const line_offset = [0x00, 0x40, 0x14, 0x54];
      return write(LCD.SETDDRAMADDR | (line_offset[y] + x), displayPorts.CMD);
    },

    /**
    Turn underline cursor off
     */
    blink_off: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSOROFF | LCD.BLINKOFF, displayPorts.CMD),

    /**
    Turn underline cursor on
     */
    blink_on: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSORON | LCD.BLINKOFF, displayPorts.CMD),

    /**
    Turn block cursor off
     */
    cursor_off: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSOROFF | LCD.BLINKON, displayPorts.CMD),

    /**
    Turn block cursor on
     */
    cursor_on: () => write(LCD.DISPLAYCONTROL | LCD.DISPLAYON | LCD.CURSORON | LCD.BLINKON, displayPorts.CMD),

    /**
    setBacklight
     */
    setBacklight: val => {
      displayPorts.backlight = (val ? 0x08 : 0x00);
      return write(LCD.DISPLAYCONTROL, displayPorts.CMD);
    },

    /**
    setContrast stub
     */
    setContrast: (val) => write(LCD.DISPLAYCONTROL, displayPorts.CMD),

    /**
    Turn display off
     */
    off: () => {
      displayPorts.backlight = 0x00;
      return write(LCD.DISPLAYCONTROL | LCD.DISPLAYOFF, displayPorts.CMD);
    },

    /**
    Turn display on
     */
    on: () => {
      displayPorts.backlight = 0x08;
      return write(LCD.DISPLAYCONTROL | LCD.DISPLAYON, displayPorts.CMD);
    },

    /**
    set special character 0..7, data is an array(8) of bytes, and then return to home addr
     */
    createChar: (ch, data) => {
      assert(Array.isArray(data));
      assert(data.length === 8);
      return write(LCD.SETCGRAMADDR | ((ch & 7) << 3), displayPorts.CMD)
      .then(() => Promise.each(data, d => write(d, displayPorts.CHR)))
      .then(() => write(LCD.SETDDRAMADDR, displayPorts.CMD))
    },
  }
}

LCD.CLEARDISPLAY = 0x01;

LCD.RETURNHOME = 0x02;

LCD.ENTRYMODESET = 0x04;

LCD.DISPLAYCONTROL = 0x08;

LCD.CURSORSHIFT = 0x10;

LCD.FUNCTIONSET = 0x20;

LCD.SETCGRAMADDR = 0x40;

LCD.SETDDRAMADDR = 0x80;

LCD.ENTRYRIGHT = 0x00;

LCD.ENTRYLEFT = 0x02;

LCD.ENTRYSHIFTINCREMENT = 0x01;

LCD.ENTRYSHIFTDECREMENT = 0x00;

LCD.DISPLAYON = 0x04;

LCD.DISPLAYOFF = 0x00;

LCD.CURSORON = 0x02;

LCD.CURSOROFF = 0x00;

LCD.BLINKON = 0x01;

LCD.BLINKOFF = 0x00;

LCD.DISPLAYMOVE = 0x08;

LCD.CURSORMOVE = 0x00;

LCD.MOVERIGHT = 0x04;

LCD.MOVELEFT = 0x00;

LCD._8BITMODE = 0x10;

LCD._4BITMODE = 0x00;

LCD._2LINE = 0x08;

LCD._1LINE = 0x00;

LCD._5x10DOTS = 0x04;

LCD._5x8DOTS = 0x00;

module.exports = LCD;