import React from 'react';


export default class Login extends React.Component {

  constructor() {
    super();
    this.state = {
      error: null,
      user: '',
      password: '',
    };
  }
  
  // This will be called when the user clicks on the login button
  login(e) {
    e.preventDefault();
    // Here, we call an external AuthService. We’ll create it in the next step
    this.props.tryLogin(this.state.user, this.state.password)
      .then(success => this.setState({error:!success}));
  }

  render() {
    return (
      <form role='form'>
      <div className='form-group'>
        {this.state.error ? 'Wrong password, try again...':''}
        <input type='text' placeholder='Username'
               valueLink={{
                 value: this.state.user,
                 requestChange: user => this.setState({user})
               }} />
        <input type='password' placeholder='Password'
               valueLink={{
                 value: this.state.password,
                 requestChange: password => this.setState({password})
               }} />
      </div>
      <button type='submit' onClick={this.login.bind(this)}>Submit</button>
      </form>
    );
  }
}