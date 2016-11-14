// -*- coding: utf-8 -*-

import 'index.html'; // make index.html get included into /build directory

import ReactDOM from 'react-dom';
import React from 'react';

import io from 'socket.io-client';
import feathers from 'feathers/client';
import socketio from 'feathers-socketio/client';

import Login from './login';

const app = feathers();

//console.log({env:process.env});


let TempsList = ({temps}) => {
  const renderTemp = (t, data) => (
    <tr key={t}>
      <th>{t}</th>
      <td>{data.t.toFixed(1)}&deg;C</td>
      <td>{(60*data.d).toFixed(2)}</td>
    </tr>
  );
  return (
    <table className="temps">
      <tbody>
        { Object.keys(temps).map( t => renderTemp(t, temps[t] )) }
      </tbody>
    </table>
  );
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
    console.log('state:',data);
    data.map( this.onPatchState );
  },
  onPatchState({id, ...vals}) {
    //console.log('patch',id,vals);
    if (id==='temps') {
      this.setState({[id]: {...this.state.temps, ...vals}});
    } else if (id==='container') {
      this.setState({[id]: vals.percent});
    } else if (id==='state') {
      this.setState(vals);
    } else {
      console.log('invalid')
    }
  },
  fetchState(socket) {
    app.service('state')
      .find()
      .then(this.onUpstreamState)
      .catch(err => console.log('state::find error',err))
  },
  componentDidMount() {
    const socket = io(process.env.NODE_ENV=='development'?'//:80/':'/',{reconnectionDelayMax:5000000});
    app.configure(socketio(socket));
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
    //app.service('state').on('created', this.onUpstreamState);
    //app.service('state').on('created', args => {console.log('#created',args)});
    app.service('state').on('patched', this.onPatchState);
  },
  powerSwitch(level) {
    let id = level + 'active'
    let active = !this.state[id];
    let newState = {};
    newState[id] = active;
    this.setState(newState);
    app.service('state').patch('state', {[id]:active});
  },
  tempUpDown(level, delta) {
    let id = level + 'target_temp';
    let value = this.state[id] + delta;
    console.log("+-", id, delta, value);
    app.service('state').patch('state', {[id]:value});
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
      {/*<Login />*/}
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
