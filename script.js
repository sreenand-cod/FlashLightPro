// Strict Mode
"use strict";

// --- State & Globals ---
const AppState = {
    track: null,
    isOn: false,
    currentMode: 'steady',
    modeInterval: null,
    timerTimeout: null,
    timerEnd: null,
    countdownInterval: null,
    wakeLock: null,
    prefs: {
        theme: 'dark',
        sound: true,
        vibration: true,
        wakelock: true
    }
};

// --- DOM Elements ---
const Elements = {
    btnPower: document.getElementById('btn-power'),
    statusText: document.getElementById('torch-status'),
    errorMsg: document.getElementById('error-message'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    timerBtns: document.querySelectorAll('.timer-btn'),
    btnCancelTimer: document.getElementById('btn-cancel-timer'),
    timerDisplay: document.getElementById('timer-display'),
    settingsBtn: document.getElementById('btn-settings'),
    settingsDialog: document.getElementById('settings-dialog'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    permissionDialog: document.getElementById('permission-dialog'),
    btnGrantPermission: document.getElementById('btn-grant-permission'),
    themeToggle: document.getElementById('theme-toggle'),
    soundToggle: document.getElementById('sound-toggle'),
    vibToggle: document.getElementById('vibration-toggle'),
    wakeToggle: document.getElementById('wakelock-toggle'),
    toastContainer: document.getElementById('toast-container')
};

// --- Sound ---
const clickSound = new Audio('assets/sounds/click.mp3');

// --- Initialization ---
async function initApp() {
    loadPreferences();
    applyPreferences();
    registerServiceWorker();
    setupEventListeners();
    await checkCapabilities();
}

function loadPreferences() {
    try {
        const saved = localStorage.getItem('flashlightProPrefs');
        if (saved) AppState.prefs = { ...AppState.prefs, ...JSON.parse(saved) };
    } catch (e) {
        console.error("Local storage access denied.");
    }
}

function savePreferences() {
    try {
        localStorage.setItem('flashlightProPrefs', JSON.stringify(AppState.prefs));
    } catch (e) {}
}

function applyPreferences() {
    document.documentElement.setAttribute('data-theme', AppState.prefs.theme);
    Elements.soundToggle.checked = AppState.prefs.sound;
    Elements.vibToggle.checked = AppState.prefs.vibration;
    Elements.wakeToggle.checked = AppState.prefs.wakelock;
}

// --- PWA Service Worker ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').catch(err => {
                showToast("Offline capability failed to initialize.");
            });
        });
    }
}

// --- Capabilities & Permissions ---
async function checkCapabilities() {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
        showError("Your browser does not support the required Media API.");
        return;
    }
    
    // Check if permission is already granted or prompt if needed
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        handleStream(stream);
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            Elements.permissionDialog.showModal();
        } else {
            showError("Camera access failed or no camera detected.");
        }
    }
}

function handleStream(stream) {
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    if (!capabilities.torch) {
        showError("Your device does not support flashlight (torch) control via browser.");
        track.stop();
        return;
    }
    AppState.track = track;
    Elements.permissionDialog.close();
    showToast("Flashlight ready.");
}

// --- Core Flashlight Control ---
async function setTorch(on) {
    if (!AppState.track) return;
    try {
        await AppState.track.applyConstraints({ advanced: [{ torch: on }] });
    } catch (err) {
        showError("Error applying torch constraint.");
    }
}

async function togglePower() {
    if (!AppState.track) {
        await checkCapabilities();
        if (!AppState.track) return;
    }

    AppState.isOn = !AppState.isOn;
    
    if (AppState.prefs.sound) clickSound.play().catch(()=>{});
    if (AppState.prefs.vibration && navigator.vibrate) navigator.vibrate(50);

    if (AppState.isOn) {
        Elements.btnPower.classList.add('active');
        Elements.statusText.innerText = `Status: ON (${AppState.currentMode})`;
        requestWakeLock();
        startMode(AppState.currentMode);
    } else {
        Elements.btnPower.classList.remove('active');
        Elements.statusText.innerText = "Status: OFF";
        releaseWakeLock();
        stopMode();
        cancelTimer();
    }
}

// --- Modes (Blink, SOS, etc.) ---
function setMode(mode, btnElement) {
    AppState.currentMode = mode;
    Elements.modeBtns.forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    
    if (AppState.isOn) {
        stopMode();
        startMode(mode);
        Elements.statusText.innerText = `Status: ON (${mode})`;
    }
}

function startMode(mode) {
    stopMode();
    if (mode === 'steady') {
        setTorch(true);
    } else if (mode === 'blink-fast') {
        runInterval(100);
    } else if (mode === 'blink-slow') {
        runInterval(500);
    } else if (mode === 'strobe') {
        runInterval(50);
    } else if (mode === 'beacon') {
        runInterval(1500, 100);
    } else if (mode === 'sos') {
        runSOS();
    }
}

function stopMode() {
    clearInterval(AppState.modeInterval);
    setTorch(false);
}

function runInterval(offMs, onMs = offMs) {
    let on = true;
    setTorch(true);
    AppState.modeInterval = setInterval(() => {
        on = !on;
        setTorch(on);
    }, on ? onMs : offMs);
}

function runSOS() {
    // Basic SOS Morse code timing representation using intervals/timeouts
    const timing = [200, 200, 200, 600, 600, 600, 200, 200, 200];
    let i = 0;
    
    function nextSignal() {
        if (!AppState.isOn || AppState.currentMode !== 'sos') return;
        setTorch(true);
        setTimeout(() => {
            setTorch(false);
            i = (i + 1) % timing.length;
            AppState.modeInterval = setTimeout(nextSignal, i === 0 ? 2000 : 200);
        }, timing[i]);
    }
    nextSignal();
}

// --- Timer Features ---
function startTimer(seconds, btnElement) {
    cancelTimer();
    
    Elements.timerBtns.forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    Elements.btnCancelTimer.classList.remove('hidden');

    if (!AppState.isOn) togglePower();

    AppState.timerEnd = Date.now() + seconds * 1000;
    
    AppState.countdownInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();

    AppState.timerTimeout = setTimeout(() => {
        if (AppState.isOn) togglePower();
        showToast("Timer completed.");
    }, seconds * 1000);
}

function cancelTimer() {
    clearTimeout(AppState.timerTimeout);
    clearInterval(AppState.countdownInterval);
    Elements.timerDisplay.innerText = "";
    Elements.timerBtns.forEach(btn => btn.classList.remove('active'));
    Elements.btnCancelTimer.classList.add('hidden');
}

function updateTimerDisplay() {
    const remaining = Math.ceil((AppState.timerEnd - Date.now()) / 1000);
    if (remaining <= 0) {
        cancelTimer();
        return;
    }
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    Elements.timerDisplay.innerText = `- ${m}:${s}`;
}

// --- Wake Lock API ---
async function requestWakeLock() {
    if (!AppState.prefs.wakelock || !('wakeLock' in navigator)) return;
    try {
        AppState.wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
        console.warn(`${err.name}, ${err.message}`);
    }
}

function releaseWakeLock() {
    if (AppState.wakeLock !== null) {
        AppState.wakeLock.release();
        AppState.wakeLock = null;
    }
}

// --- Utilities ---
function showError(msg) {
    Elements.errorMsg.innerText = msg;
    Elements.errorMsg.classList.remove('hidden');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    Elements.toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// --- Event Listeners ---
function setupEventListeners() {
    Elements.btnPower.addEventListener('click', togglePower);
    
    Elements.modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            setMode(e.target.dataset.mode, e.target);
        });
    });

    Elements.timerBtns.forEach(btn => {
        if(btn.id !== 'btn-cancel-timer') {
            btn.addEventListener('click', (e) => {
                startTimer(parseInt(e.target.dataset.time), e.target);
            });
        }
    });

    Elements.btnCancelTimer.addEventListener('click', cancelTimer);

    Elements.btnGrantPermission.addEventListener('click', async () => {
        await checkCapabilities();
    });

    // Settings
    Elements.settingsBtn.addEventListener('click', () => Elements.settingsDialog.showModal());
    Elements.btnCloseSettings.addEventListener('click', () => Elements.settingsDialog.close());

    Elements.themeToggle.addEventListener('click', () => {
        AppState.prefs.theme = AppState.prefs.theme === 'dark' ? 'light' : 'dark';
        applyPreferences();
        savePreferences();
    });

    Elements.soundToggle.addEventListener('change', (e) => {
        AppState.prefs.sound = e.target.checked;
        savePreferences();
    });

    Elements.vibToggle.addEventListener('change', (e) => {
        AppState.prefs.vibration = e.target.checked;
        savePreferences();
    });

    Elements.wakeToggle.addEventListener('change', (e) => {
        AppState.prefs.wakelock = e.target.checked;
        savePreferences();
    });

    // Handle document visibility change for WakeLock
    document.addEventListener('visibilitychange', () => {
        if (AppState.wakeLock !== null && document.visibilityState === 'visible') {
            requestWakeLock();
        }
    });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
