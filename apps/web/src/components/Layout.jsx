import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import bannerImg from '../assets/handloom_banner.png';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout-container">
      {/* Repeating Temple Border Motif Top */}
      <div className="temple-border top"></div>

      <div className="layout-wrapper">
        
        {/* Left Side: Brand Story Banner */}
        <div className="layout-banner">
          <img src={bannerImg} alt="Indian Handloom Silk Threads" className="banner-bg-img" />
          <div className="banner-content">
            <div className="banner-header">
              <div className="brand-logo-container">
                <Sparkles size={28} className="brand-icon" />
                <h1 className="brand-name">Nandam</h1>
              </div>
              <span className="brand-tagline">Heritage Handlooms</span>
            </div>
            
            <div className="banner-middle">
              <h2 className="banner-headline">
                Crafting Heritage, <span>One Thread</span> at a Time.
              </h2>
              <p className="banner-desc">
                Experience the luxury of handwoven sarees, pure silk, and traditional craftsmanship curated directly from certified master artisans of India.
              </p>
            </div>

            <div className="banner-footer">
              <p>© {new Date().getFullYear()} Nandam Handlooms. Authenticity Guaranteed.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Page content */}
        <div className="layout-page-content">
          <Outlet />
        </div>

      </div>

      {/* Repeating Temple Border Motif Bottom */}
      <div className="temple-border bottom"></div>
    </div>
  );
}
