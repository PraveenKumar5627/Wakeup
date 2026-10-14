import React, { useState, useEffect } from 'react';
import StatusBar from '../components/StatusBar';
import { MapPin, Bell, Navigation, ArrowRight, Check } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  const [stage, setStage] = useState('splash'); // 'splash' | 'onboarding'
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // Check if onboarding was previously completed
    const onboardingDone = localStorage.getItem('arrivo_onboarding_done_v2');

    const timer = setTimeout(() => {
      if (onboardingDone) {
        onFinish();
      } else {
        setStage('onboarding');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  const handleCompleteOnboarding = () => {
    localStorage.setItem('arrivo_onboarding_done_v2', 'true');
    onFinish();
  };

  const slides = [
    {
      title: 'Smart Destination Alarms',
      desc: 'Set custom distance buffers (2 km, 3 km, 5 km) so you can sleep peacefully on long journeys.',
      icon: Bell,
      color: '#F59E0B',
    },
    {
      title: 'Interactive Route Tracking',
      desc: 'Pinpoint any bus station, train stop, or destination anywhere in the world on real maps.',
      icon: MapPin,
      color: '#1E6BFF',
    },
    {
      title: 'Never Miss Your Stop',
      desc: 'High-accuracy GPS monitoring sounds a repeating audio chime & vibration before arrival.',
      icon: Navigation,
      color: '#10B981',
    },
  ];

  if (stage === 'splash') {
    return (
      <div className="screen-splash" onClick={() => setStage('onboarding')}>
        <StatusBar theme="dark" />
        <div className="splash-center">
          <div className="splash-logo-card">
            <div className="splash-logo-art">
              <span className="logo-letter">A</span>
              <span className="logo-word">rraivo</span>
              <div className="logo-sunrise-arc"></div>
            </div>
            <p className="splash-brand-sub">TRAVEL ALARM</p>
          </div>
          <p className="splash-tagline">Your destination is closer than you think.</p>
        </div>
        <div className="splash-footer">
          <div className="splash-loader-dots">
            <span className="dot dot-1"></span>
            <span className="dot dot-2"></span>
            <span className="dot dot-3"></span>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding stage
  const currentSlide = slides[slide];
  const Icon = currentSlide.icon;

  return (
    <div className="screen-onboarding">
      <StatusBar theme="light" />

      <div className="onboarding-top-bar">
        <button
          type="button"
          className="onboarding-skip-btn"
          onClick={handleCompleteOnboarding}
        >
          Skip
        </button>
      </div>

      <div className="onboarding-content">
        <div className="onboarding-illustration" style={{ borderColor: `${currentSlide.color}33` }}>
          <div className="onboarding-icon-bg" style={{ backgroundColor: `${currentSlide.color}15`, color: currentSlide.color }}>
            <Icon size={56} strokeWidth={2.2} />
          </div>
        </div>

        <h2 className="onboarding-title">{currentSlide.title}</h2>
        <p className="onboarding-desc">{currentSlide.desc}</p>

        {/* Indicators */}
        <div className="onboarding-dots">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === slide ? 'active' : ''}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </div>

      <div className="onboarding-footer">
        {slide < slides.length - 1 ? (
          <button
            type="button"
            className="btn-primary-blue onboarding-next-btn"
            onClick={() => setSlide((prev) => prev + 1)}
          >
            <span>Next</span>
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary-blue onboarding-next-btn"
            onClick={handleCompleteOnboarding}
          >
            <span>Get Started</span>
            <Check size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
