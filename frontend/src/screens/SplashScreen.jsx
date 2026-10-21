import React, { useState, useEffect } from 'react';
import StatusBar from '../components/StatusBar';
import arraivoSplash from '../assets/arraivo_splash.png';
import { MapPin, Bell, Navigation, ArrowRight, Check } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  const [stage, setStage] = useState('splash'); // 'splash' | 'onboarding'
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceSplash = params.get('splash') === '1' || params.get('splash') === 'true';

    // Check if onboarding was previously completed
    const onboardingDone = !forceSplash && localStorage.getItem('arrivo_onboarding_done_v2');

    const timer = setTimeout(() => {
      if (forceSplash) return;
      if (onboardingDone) {
        onFinish();
      } else {
        setStage('onboarding');
      }
    }, 2500);

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
        <div className="splash-pure-content">
          <img
            src={arraivoSplash}
            alt="Arraivo"
            className="splash-pure-img"
          />
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
