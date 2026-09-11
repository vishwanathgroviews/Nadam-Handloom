import React from 'react';
import './TraditionalBorder.css';

// A slow, continuous strip of a repeating diamond motif — a signature
// transitional accent placed once, right under the hero.
export default function TraditionalBorder() {
  return (
    <div className="traditional-border" aria-hidden="true">
      <div className="traditional-border-track" />
    </div>
  );
}
