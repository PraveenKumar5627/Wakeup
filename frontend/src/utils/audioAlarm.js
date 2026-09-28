/**
 * Audio Alarm Utility using Web Audio API
 * Generates an audible alarm sound (two-tone repeating wake-up chime)
 * completely synthesized in the browser without requiring external audio files.
 */

class AlarmSoundManager {
  constructor() {
    this.audioCtx = null;
    this.timerId = null;
    this.isPlaying = false;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBeep(frequency, duration, type = 'sine') {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      // Volume envelope to prevent harsh clicking
      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, this.audioCtx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  startAlarm() {
    if (this.isPlaying) return;
    this.initContext();
    this.isPlaying = true;

    // Trigger device vibration if available (pattern: 600ms buzz, 300ms pause)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([600, 300, 600, 300, 600]);
      } catch (e) {
        // Ignore vibration errors if blocked
      }
    }

    let toggle = false;
    // Play immediately
    this.playBeep(880, 0.25, 'triangle'); // High A5

    // Repeat alarm chime every 400ms
    this.timerId = setInterval(() => {
      toggle = !toggle;
      const freq = toggle ? 987.77 : 783.99; // B5 and G5 alternation
      this.playBeep(freq, 0.28, 'triangle');

      // Continue vibration loop on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate && toggle) {
        try {
          navigator.vibrate(300);
        } catch (e) {}
      }
    }, 450);
  }

  stopAlarm() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0); // Stop vibration
      } catch (e) {}
    }
  }
}

export const alarmAudio = new AlarmSoundManager();
