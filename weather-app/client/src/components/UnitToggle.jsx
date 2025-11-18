import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';

export default function UnitToggle() {
  const { state, dispatch } = useContext(AppContext);
  return (
    <div style={{ marginTop: '1rem' }}>
      <label className="muted">Temperature Unit:</label>
      <select
        value={state.unit}
        onChange={(e) => dispatch({ type: 'SET_UNIT', payload: e.target.value })}
      >
        <option value="metric">°C (Metric)</option>
        <option value="imperial">°F (Imperial)</option>
      </select>
    </div>
  );
}
