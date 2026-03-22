import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Dashboard />
      </div>
    </Router>
  );
}

export default App;
