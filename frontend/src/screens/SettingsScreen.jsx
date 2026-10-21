import React, { useState, useEffect, useRef } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNavBar from '../components/BottomNavBar';
import {
  ArrowLeft,
  User,
  MapPin,
  Bell,
  Volume2,
  Clock,
  Navigation,
  Shield,
  HelpCircle,
  Info,
  Smartphone,
  Check,
  Play,
  RotateCcw,
  Music,
  FolderOpen,
  Upload,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';
import { alarmAudio } from '../utils/audioAlarm';
import {
  saveCustomAudioFile,
  getCustomAudioFile,
  deleteCustomAudioFile,
} from '../utils/customAudioDB';

export default function SettingsScreen({
  userName = 'Praveen',
  onUpdateUserName,
  locationPermStatus = 'granted',
  onRequestPermission,
  onOpenLocationSettings,
  onTabChange,
  isTripActive = false,
  showBottomNav = true,
  onBack,
  theme = 'light',
  onToggleTheme,
  onSetTheme,
}) {
  const [selectedTone, setSelectedTone] = useState(
    () => localStorage.getItem('arrivo_setting_tone') || 'transit'
  );
  const [snoozeMinutes, setSnoozeMinutes] = useState(
    () => Number(localStorage.getItem('arrivo_setting_snooze')) || 5
  );
  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('arrivo_setting_unit') || 'km'
  );
  const [vibrateEnabled, setVibrateEnabled] = useState(
    () => localStorage.getItem('arrivo_setting_vibrate') !== 'false'
  );
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  // Custom song from phone's file manager
  const [customSongName, setCustomSongName] = useState(
    () => localStorage.getItem('arrivo_custom_audio_name') || ''
  );
  const [isCustomPreviewing, setIsCustomPreviewing] = useState(false);
  const fileInputRef = useRef(null);

  // Load custom audio metadata on mount
  useEffect(() => {
    getCustomAudioFile().then((data) => {
      if (data && data.fileName) {
        setCustomSongName(data.fileName);
      }
    });
  }, []);

  const handleToneChange = (tone) => {
    setSelectedTone(tone);
    localStorage.setItem('arrivo_setting_tone', tone);
    alarmAudio.setTone(tone);
  };

  const handlePreviewSound = (tone) => {
    setIsPlayingPreview(true);
    alarmAudio.previewTone(tone);
    setTimeout(() => setIsPlayingPreview(false), 900);
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Selected audio file is too large. Please select a song under 25MB.');
      return;
    }

    try {
      await saveCustomAudioFile(file, file.name);
      alarmAudio.setCustomAudioBlob(file, file.name);
      setCustomSongName(file.name);
      localStorage.setItem('arrivo_custom_audio_name', file.name);
      handleToneChange('custom');

      // Quick 3-second preview so user confirms it sounds great
      setIsCustomPreviewing(true);
      alarmAudio.previewTone('custom');
      setTimeout(() => setIsCustomPreviewing(false), 3200);
    } catch (err) {
      console.error('Failed to set custom song:', err);
      alert('Could not load audio file. Please try another audio format (MP3, WAV, M4A, AAC).');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleCustomPreview = (e) => {
    e.stopPropagation();
    if (isCustomPreviewing) {
      alarmAudio.stopPreview();
      setIsCustomPreviewing(false);
    } else {
      setIsCustomPreviewing(true);
      alarmAudio.previewTone('custom');
      setTimeout(() => setIsCustomPreviewing(false), 4000);
    }
  };

  const handleRemoveCustomSong = async (e) => {
    e.stopPropagation();
    alarmAudio.stopPreview();
    setIsCustomPreviewing(false);
    await deleteCustomAudioFile();
    alarmAudio.clearCustomAudio();
    setCustomSongName('');
    localStorage.removeItem('arrivo_custom_audio_name');
    if (selectedTone === 'custom') {
      handleToneChange('transit');
    }
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onUpdateUserName(nameInput.trim());
      localStorage.setItem('arrivo_user_name', nameInput.trim());
    }
    setEditingName(false);
  };

  const isGranted = locationPermStatus === 'granted';

  return (
    <div className="screen-container screen-settings">
      <StatusBar theme="light" />

      {/* Header */}
      <header className="screen-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              type="button"
              className="header-back-btn"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="header-title">Settings</h2>
        </div>
        {onToggleTheme && (
          <button
            type="button"
            className="header-icon-btn theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun size={20} className="theme-icon-sun" />
            ) : (
              <Moon size={20} className="theme-icon-moon" />
            )}
          </button>
        )}
      </header>

      <main className="settings-scroll-content">
        {/* User Profile Card */}
        <section className="settings-profile-card">
          <div className="profile-avatar-circle">
            <User size={30} className="text-white" />
          </div>
          <div className="profile-details">
            {editingName ? (
              <div className="profile-edit-box">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="profile-name-input"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-save-name"
                  onClick={handleSaveName}
                >
                  Save
                </button>
              </div>
            ) : (
              <>
                <h3 className="profile-name">{userName}</h3>
                <p className="profile-role">Transit Explorer</p>
                <button
                  type="button"
                  className="profile-edit-btn"
                  onClick={() => setEditingName(true)}
                >
                  Edit profile name
                </button>
              </>
            )}
          </div>
        </section>

        {/* Location Permission Status Section */}
        <section className="settings-card-group">
          <h4 className="settings-group-title">LOCATION & GPS</h4>
          <div className="settings-row-item">
            <div className="settings-row-left">
              <Navigation size={18} className="text-blue-600" />
              <div>
                <div className="row-main-label">Location Permission</div>
                <div className="row-sub-label">
                  Required to track distance and fire wake-up alarms
                </div>
              </div>
            </div>
            <div className="settings-row-right">
              {isGranted ? (
                <span className="badge-granted">
                  <Check size={12} className="mr-1 inline" /> Granted
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-enable-sm"
                  onClick={onRequestPermission}
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          <div className="settings-row-item" onClick={onOpenLocationSettings}>
            <div className="settings-row-left">
              <Smartphone size={18} className="text-slate-600" />
              <div>
                <div className="row-main-label">Android Background Tracking</div>
                <div className="row-sub-label">
                  Keep app alive in background / Disable battery optimization
                </div>
              </div>
            </div>
            <span className="text-xs text-blue-600 font-semibold cursor-pointer">
              View Guide
            </span>
          </div>
        </section>

        {/* Alarm Sound Tone Selection */}
        <section className="settings-card-group">
          <h4 className="settings-group-title">ALARM & AUDIO</h4>

          <div className="settings-tone-selector">
            <div className="row-main-label mb-2">Alarm Ringtone</div>
            <div className="tone-chips-grid">
              {[
                { id: 'transit', label: 'Transit Chime' },
                { id: 'gentle', label: 'Gentle Wakeup' },
                { id: 'siren', label: 'Digital Siren' },
                { id: 'bell', label: 'Classic Bell' },
              ].map((tone) => (
                <div
                  key={tone.id}
                  className={`tone-card ${
                    selectedTone === tone.id ? 'tone-selected' : ''
                  }`}
                  onClick={() => handleToneChange(tone.id)}
                >
                  <div className="tone-title">{tone.label}</div>
                  <button
                    type="button"
                    className="tone-preview-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewSound(tone.id);
                    }}
                    title="Play Preview"
                  >
                    <Play size={12} className="fill-current" />
                  </button>
                </div>
              ))}
            </div>

            {/* Hidden native mobile file input to access device file manager */}
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
              id="input-custom-song-file"
            />

            {/* Custom Song Choice / Active Card */}
            {customSongName ? (
              <div
                className={`custom-song-card ${selectedTone === 'custom' ? 'tone-selected' : ''}`}
                onClick={() => handleToneChange('custom')}
              >
                <div className="custom-song-left">
                  <div className="custom-song-icon-badge">
                    <Music size={18} className="text-blue-600" />
                  </div>
                  <div className="custom-song-details">
                    <div className="custom-song-badge">CUSTOM ALARM SONG</div>
                    <div className="custom-song-filename" title={customSongName}>
                      {customSongName}
                    </div>
                  </div>
                </div>

                <div className="custom-song-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`custom-preview-btn ${isCustomPreviewing ? 'is-playing' : ''}`}
                    onClick={handleToggleCustomPreview}
                    title={isCustomPreviewing ? 'Stop Preview' : 'Preview Custom Song'}
                  >
                    <Play size={13} className="fill-current" />
                  </button>
                  <button
                    type="button"
                    className="custom-action-icon-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Choose Another Song from Phone Files"
                  >
                    <FolderOpen size={15} />
                  </button>
                  <button
                    type="button"
                    className="custom-action-icon-btn custom-delete-btn"
                    onClick={handleRemoveCustomSong}
                    title="Remove Custom Song"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-choose-custom-song"
                onClick={() => fileInputRef.current?.click()}
                id="btn-open-file-manager"
              >
                <div className="choose-song-icon-box">
                  <Music size={18} className="text-blue-600" />
                </div>
                <div className="choose-song-text">
                  <span className="choose-song-title">Set Custom Song</span>
                  <span className="choose-song-sub">Choose any MP3, AAC, or song from phone files</span>
                </div>
                <div className="choose-song-arrow">
                  <FolderOpen size={16} className="text-blue-600" />
                </div>
              </button>
            )}
          </div>

          {/* Snooze Duration */}
          <div className="settings-row-item">
            <div className="settings-row-left">
              <Clock size={18} className="text-amber-500" />
              <div>
                <div className="row-main-label">Snooze Duration</div>
                <div className="row-sub-label">Delay before alarm re-triggers</div>
              </div>
            </div>
            <select
              value={snoozeMinutes}
              onChange={(e) => {
                const mins = Number(e.target.value);
                setSnoozeMinutes(mins);
                localStorage.setItem('arrivo_setting_snooze', String(mins));
              }}
              className="settings-select-input"
            >
              <option value={3}>3 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
            </select>
          </div>

          {/* Vibration */}
          <div className="settings-row-item">
            <div className="settings-row-left">
              <Smartphone size={18} className="text-indigo-600" />
              <div>
                <div className="row-main-label">Haptic Vibration</div>
                <div className="row-sub-label">Vibrate phone when alarm sounds</div>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={vibrateEnabled}
                onChange={(e) => {
                  setVibrateEnabled(e.target.checked);
                  localStorage.setItem(
                    'arrivo_setting_vibrate',
                    String(e.target.checked)
                  );
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* Units & Preferences */}
        <section className="settings-card-group">
          <h4 className="settings-group-title">UNITS & PREFERENCES</h4>
          <div className="settings-row-item">
            <div className="settings-row-left">
              <MapPin size={18} className="text-teal-600" />
              <div>
                <div className="row-main-label">Distance Units</div>
                <div className="row-sub-label">Kilometers or Miles</div>
              </div>
            </div>
            <div className="unit-toggle-pill">
              <button
                type="button"
                className={`unit-btn ${distanceUnit === 'km' ? 'unit-active' : ''}`}
                onClick={() => {
                  setDistanceUnit('km');
                  localStorage.setItem('arrivo_setting_unit', 'km');
                }}
              >
                km
              </button>
              <button
                type="button"
                className={`unit-btn ${distanceUnit === 'mi' ? 'unit-active' : ''}`}
                onClick={() => {
                  setDistanceUnit('mi');
                  localStorage.setItem('arrivo_setting_unit', 'mi');
                }}
              >
                mi
              </button>
            </div>
          </div>

          {/* Appearance / Theme */}
          <div className="settings-row-item">
            <div className="settings-row-left">
              {theme === 'dark' ? (
                <Moon size={18} className="text-indigo-400" />
              ) : (
                <Sun size={18} className="text-amber-500" />
              )}
              <div>
                <div className="row-main-label">Theme Mode</div>
                <div className="row-sub-label">Switch between Light and Dark interface</div>
              </div>
            </div>
            <div className="unit-toggle-pill theme-mode-pill">
              <button
                type="button"
                className={`unit-btn ${theme === 'light' ? 'unit-active' : ''}`}
                onClick={() => (onSetTheme ? onSetTheme('light') : onToggleTheme())}
                id="btn-theme-light"
              >
                <Sun size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                Light
              </button>
              <button
                type="button"
                className={`unit-btn ${theme === 'dark' ? 'unit-active' : ''}`}
                onClick={() => (onSetTheme ? onSetTheme('dark') : onToggleTheme())}
                id="btn-theme-dark"
              >
                <Moon size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                Dark
              </button>
            </div>
          </div>
        </section>

        {/* About & Info */}
        <section className="settings-card-group">
          <h4 className="settings-group-title">ABOUT</h4>
          <div className="settings-row-item">
            <div className="settings-row-left">
              <Info size={18} className="text-slate-600" />
              <div>
                <div className="row-main-label">TravelAlarm / Arraivo</div>
                <div className="row-sub-label">Version 2.0.0 • Mobile Release</div>
              </div>
            </div>
            <span className="text-xs text-slate-400">Up to date</span>
          </div>

          <div className="settings-row-item">
            <div className="settings-row-left">
              <Shield size={18} className="text-slate-600" />
              <div>
                <div className="row-main-label">Privacy Policy</div>
                <div className="row-sub-label">
                  Location data is never uploaded or shared with 3rd parties
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showBottomNav && (
        <BottomNavBar
          activeTab="settings"
          onTabChange={onTabChange}
          isTripActive={isTripActive}
        />
      )}
    </div>
  );
}
