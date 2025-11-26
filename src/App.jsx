import React from 'react';
import MusicPlayer from './components/MusicPlayer';
import './App.css';

function App() {
  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Top Left Box */}
        <div className="dashboard-box box-1">
          <h2>Productivity</h2>
          <p>Focus Timer / Tasks</p>
        </div>

        {/* Top Right Box: Music Player */}
        <div className="dashboard-box box-2">
          <MusicPlayer />
        </div>

        {/* Bottom Left Box */}
        <div className="dashboard-box box-3">
          <h2>Calendar</h2>
          <p>Upcoming Events</p>
        </div>

        {/* Bottom Right Box */}
        <div className="dashboard-box box-4">
          <h2>Notes</h2>
          <p>Quick Scratchpad</p>
        </div>
      </div>
    </div>
  );
}

export default App;
