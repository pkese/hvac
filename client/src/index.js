// -*- coding: utf-8 -*-


import ReactDOM from 'react-dom';
import React from 'react';
import io from 'socket.io-client';

//import 'index.html';

let TempsList = ({temps}) => {
  let renderTemp = (t, data) => (<tr><th>{t}</th><td>{data.t.toFixed(2)}&deg;C</td><td>{(60*data.d).toFixed(2)}</td></tr>);
  let htmls = [];
  for (var t in temps)
    htmls.push(renderTemp(t, temps[t]));
  return <table className="temps"><tbody>{htmls}</tbody></table>
};
let Floor = ({level /*L0 L1 L2*/ , label, active, temp, rh, target_temp, activate, tempUpDown}) => {
  return (
    <div className={"panel floor " + (active ? 'active' : 'inactive')}>
      <h2>{label}</h2>
      <ul className='configPanel'>
        <li>
          <div>
          <input type="checkbox" checked={active} onClick={()=>activate(level)}/>
          </div>
          <p>Vklop<br/>ogrevanja</p>
        </li>
        <li>
          <div className="currTemp">{temp ? temp.toFixed(1) : '?'}&deg;</div>
          <p>Trenutna<br/>temperatura </p>
        </li>
        <li>
          <div className="currRh">{rh ? rh.toFixed(0) : '?'}%</div>
          <p>Relativna<br/>vlažnost</p>
        </li>
      </ul>
      <div className='tempUpDown'>
        <div><a onClick={()=>tempUpDown(level, +.5)}>+</a></div>
        <div>{target_temp ? target_temp : '?'}&deg;</div>
        <div><a onClick={()=>tempUpDown(level, -.5)}>-</a></div>
      </div>
    </div>
  );
}
let App = React.createClass({
  getInitialState() {return {
    // socket
    temps: {},
    L0active:false, L1active:false,
    heatL0: false, heatL1: false, heatBoiler: false,
    container: 0,
    connected: false,
  }},
  onUpstreamState(data) {
    if (data===null) return;
    //console.log(data);
    this.setState(data);
    var newState = data.state;  // copy everything from data.state to root level,
    newState.temps = data.temps;  // leave 'temps' as separate structure
    this.setState(newState);
  },
  fetchState(socket) {
    socket.emit('state::find', {}, (err,state) => {
      console.log('state::find');
      if (err) console.log('state::find error',err);
      else this.onUpstreamState(state);
    });
  },
  componentDidMount() {
    let socket = io('/', {reconnectionDelayMax:5000000});
    console.log('io',socket);
    this.setState({socket:socket});
    const connected = () => {
      console.log('connect',arguments);
      this.setState({connected:true});
      this.fetchState(socket);
    }
    socket.on('connect', connected);
    socket.on('reconnect', connected);
    socket.on('disconnect',() => {
      console.log('disconnect',arguments);
      this.setState({connected:false});
    });
    socket.on('state created', this.onUpstreamState);
  },
  powerSwitch(level) {
    let id = level + 'active'
    let active = !this.state[id];
    let newState = {};
    newState[id] = active;
    this.setState(newState);
    this.state.socket.emit('state::update', id, {value:active});
  },
  tempUpDown(level, delta) {
    let id = level + 'target_temp';
    let value = this.state[id] + delta;
    console.log("+-", id, delta, value);
    this.state.socket.emit('state::update', id, {value:value});
    let newState = {};
    newState[id] = value;
    this.setState(newState);
  },
  render() {
    //console.log(this.state);
    let container = '';
    if (this.state.temps.cont1) container = this.state.temps.cont1.t.toFixed(0) + '/' + this.state.temps.cont2.t.toFixed(0) + '/' + this.state.temps.cont3.t.toFixed(0) + '/' + this.state.temps.cont4.t.toFixed(0);
    return (
      <div>
        <div className='panel'>
          <h2 style={{marginTop:0, textDecoration:(this.state.connected?'none':'line-through')}}>Stanje</h2>
          <ul>
            <li>
              <div style={{width:40}}>{this.state.container.toFixed(1)}<small>%</small></div>
              <p style={{marginRight:0}}>Zalogovnik<br/><small>{container?container:'??'}&deg;C</small></p>
            </li>
          </ul>
        </div>

        <div className='status panel'>
          Ogrevanje: &nbsp;
          <div className={'L1 '+(this.state.heatL1?'active':'inactive')}>pritličje</div>
          <div className={'L0 '+(this.state.heatL0?'active':'inactive')}>klet</div>
          <div className={'boiler '+(this.state.heatBoiler?'active':'inactive')}>bojler</div>
        </div>

        <div style={{clear:'both'}}>&nbsp;</div>
        <hr/>

        <Floor
          level="L1"
          label="Pritličje"
          active={this.state.L1active}
          temp={this.state.L1report ? this.state.L1report.temp : this.state.L1temp_estimate}
          rh={this.state.L1report ? this.state.L1report.rh : undefined}
          target_temp={this.state.L1target_temp}
          activate={this.powerSwitch}
          tempUpDown={this.tempUpDown}
        />

        <Floor
          level="L0"
          label="Klet"
          active={this.state.L0active}
          temp={this.state.L0report ? this.state.L0report.temp : 0}
          rh={this.state.L0report ? this.state.L0report.rh : undefined}
          target_temp={this.state.L0target_temp}
          activate={this.powerSwitch}
          tempUpDown={this.tempUpDown}
        />

        <hr style={{clear:'both'}}/>

        <TempsList temps={this.state.temps} />
      </div>
    );
  }
});
ReactDOM.render(<App/>, document.getElementById('app'));
