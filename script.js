const MODES = {
  focus: { label: "Foco", defaultMinutes: 25, accent: "#c8553d" },
  shortBreak: { label: "Pausa curta", defaultMinutes: 5, accent: "#546a2f" },
  longBreak: { label: "Pausa longa", defaultMinutes: 15, accent: "#3d6d7a" }
};

const elements = {
  timerDisplay: document.getElementById("timer-display"),
  timerLabel: document.getElementById("timer-label"),
  cycleDisplay: document.getElementById("cycle-display"),
  timerStatus: document.getElementById("timer-status"),
  currentModeLabel: document.getElementById("current-mode-label"),
  completedSessions: document.getElementById("completed-sessions"),
  focusMinutes: document.getElementById("focus-minutes"),
  progressRing: document.getElementById("progress-ring"),
  startPomodoro: document.getElementById("start-pomodoro"),
  pausePomodoro: document.getElementById("pause-pomodoro"),
  resetPomodoro: document.getElementById("reset-pomodoro"),
  settingsForm: document.getElementById("settings-form"),
  modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
  inputs: {
    focus: document.getElementById("focus-duration"),
    shortBreak: document.getElementById("short-break-duration"),
    longBreak: document.getElementById("long-break-duration"),
    cyclesBeforeLongBreak: document.getElementById("cycles-before-long-break"),
    minuteChime: document.getElementById("minute-chime"),
    phaseAlert: document.getElementById("phase-alert")
  },
  stopwatchDisplay: document.getElementById("stopwatch-display"),
  startStopwatch: document.getElementById("start-stopwatch"),
  lapStopwatch: document.getElementById("lap-stopwatch"),
  resetStopwatch: document.getElementById("reset-stopwatch"),
  lapList: document.getElementById("lap-list")
};

const circumference = 2 * Math.PI * 52;

const pomodoroState = {
  mode: "focus",
  isRunning: false,
  totalSeconds: MODES.focus.defaultMinutes * 60,
  remainingSeconds: MODES.focus.defaultMinutes * 60,
  completedFocusSessions: 0,
  accumulatedFocusSeconds: 0,
  currentCycle: 1,
  intervalId: null,
  lastMinuteSignal: MODES.focus.defaultMinutes
};

const stopwatchState = {
  isRunning: false,
  elapsedMs: 0,
  startedAt: 0,
  intervalId: null,
  laps: []
};

function getSettings() {
  return {
    focus: clampNumber(elements.inputs.focus.value, 1, 90, 25),
    shortBreak: clampNumber(elements.inputs.shortBreak.value, 1, 30, 5),
    longBreak: clampNumber(elements.inputs.longBreak.value, 1, 60, 15),
    cyclesBeforeLongBreak: clampNumber(elements.inputs.cyclesBeforeLongBreak.value, 2, 8, 4),
    minuteChime: elements.inputs.minuteChime.checked,
    phaseAlert: elements.inputs.phaseAlert.checked
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatStopwatch(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function syncPomodoroDuration(mode, preserveRemaining = false) {
  const settings = getSettings();
  const nextTotalSeconds = settings[mode] * 60;
  pomodoroState.mode = mode;
  pomodoroState.totalSeconds = nextTotalSeconds;
  pomodoroState.remainingSeconds = preserveRemaining
    ? Math.min(pomodoroState.remainingSeconds, nextTotalSeconds)
    : nextTotalSeconds;
  pomodoroState.lastMinuteSignal = Math.ceil(pomodoroState.remainingSeconds / 60);
  renderPomodoro();
}

function renderPomodoro() {
  const modeConfig = MODES[pomodoroState.mode];
  const progress = pomodoroState.remainingSeconds / pomodoroState.totalSeconds;
  const dashOffset = circumference * (1 - progress);

  elements.timerDisplay.textContent = formatClock(pomodoroState.remainingSeconds);
  elements.timerLabel.textContent = pomodoroState.isRunning ? "Tempo restante" : "Ajuste e inicie";
  elements.cycleDisplay.textContent = `Ciclo ${pomodoroState.currentCycle} de ${getSettings().cyclesBeforeLongBreak}`;
  elements.currentModeLabel.textContent = modeConfig.label;
  elements.completedSessions.textContent = String(pomodoroState.completedFocusSessions);
  elements.focusMinutes.textContent = `${Math.floor(pomodoroState.accumulatedFocusSeconds / 60)} min`;
  elements.progressRing.style.strokeDasharray = String(circumference);
  elements.progressRing.style.strokeDashoffset = String(dashOffset);
  elements.progressRing.style.stroke = modeConfig.accent;

  elements.modeTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === pomodoroState.mode);
  });

  document.documentElement.style.setProperty("--accent", modeConfig.accent);
}

function updateStatus(text) {
  elements.timerStatus.textContent = text;
}

function playTone(frequency, duration, type = "sine", volume = 0.03) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = volume;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);
  oscillator.onended = () => {
    context.close();
  };
}

function playMinuteChime() {
  playTone(880, 0.12, "triangle", 0.02);
}

function playPhaseAlert() {
  playTone(660, 0.16, "sine", 0.03);
  setTimeout(() => playTone(880, 0.18, "sine", 0.03), 180);
}

function advanceMode() {
  const settings = getSettings();

  if (pomodoroState.mode === "focus") {
    pomodoroState.completedFocusSessions += 1;
    pomodoroState.accumulatedFocusSeconds += pomodoroState.totalSeconds;

    if (pomodoroState.completedFocusSessions % settings.cyclesBeforeLongBreak === 0) {
      pomodoroState.currentCycle = settings.cyclesBeforeLongBreak;
      syncPomodoroDuration("longBreak");
      updateStatus("Pausa longa iniciada");
    } else {
      pomodoroState.currentCycle = (pomodoroState.completedFocusSessions % settings.cyclesBeforeLongBreak) + 1;
      syncPomodoroDuration("shortBreak");
      updateStatus("Pausa curta iniciada");
    }
  } else {
    pomodoroState.currentCycle = (pomodoroState.completedFocusSessions % settings.cyclesBeforeLongBreak) + 1;
    syncPomodoroDuration("focus");
    updateStatus("Novo bloco de foco pronto");
  }

  if (settings.phaseAlert) {
    playPhaseAlert();
  }
}

function tickPomodoro() {
  pomodoroState.remainingSeconds -= 1;

  if (pomodoroState.mode === "focus") {
    const minuteMark = Math.ceil(pomodoroState.remainingSeconds / 60);
    if (
      getSettings().minuteChime &&
      pomodoroState.remainingSeconds > 0 &&
      pomodoroState.remainingSeconds % 60 === 0 &&
      minuteMark !== pomodoroState.lastMinuteSignal
    ) {
      pomodoroState.lastMinuteSignal = minuteMark;
      playMinuteChime();
    }
  }

  if (pomodoroState.remainingSeconds <= 0) {
    clearInterval(pomodoroState.intervalId);
    pomodoroState.intervalId = null;
    pomodoroState.isRunning = false;
    advanceMode();
  }

  renderPomodoro();
}

function startPomodoro() {
  if (pomodoroState.isRunning) {
    return;
  }

  pomodoroState.isRunning = true;
  pomodoroState.lastMinuteSignal = Math.ceil(pomodoroState.remainingSeconds / 60);
  updateStatus(`Rodando: ${MODES[pomodoroState.mode].label}`);
  pomodoroState.intervalId = window.setInterval(tickPomodoro, 1000);
  renderPomodoro();
}

function pausePomodoro() {
  if (!pomodoroState.isRunning) {
    return;
  }

  clearInterval(pomodoroState.intervalId);
  pomodoroState.intervalId = null;
  pomodoroState.isRunning = false;
  updateStatus("Timer pausado");
  renderPomodoro();
}

function resetPomodoro() {
  clearInterval(pomodoroState.intervalId);
  pomodoroState.intervalId = null;
  pomodoroState.isRunning = false;
  syncPomodoroDuration(pomodoroState.mode);
  updateStatus("Timer reiniciado");
}

function applySettings() {
  const currentMode = pomodoroState.mode;
  syncPomodoroDuration(currentMode, pomodoroState.isRunning);
  renderPomodoro();
}

function renderStopwatch() {
  const elapsed = stopwatchState.isRunning
    ? stopwatchState.elapsedMs + (Date.now() - stopwatchState.startedAt)
    : stopwatchState.elapsedMs;

  elements.stopwatchDisplay.textContent = formatStopwatch(elapsed);
}

function startStopwatch() {
  if (stopwatchState.isRunning) {
    clearInterval(stopwatchState.intervalId);
    stopwatchState.elapsedMs += Date.now() - stopwatchState.startedAt;
    stopwatchState.isRunning = false;
    stopwatchState.intervalId = null;
    elements.startStopwatch.textContent = "Iniciar";
    renderStopwatch();
    return;
  }

  stopwatchState.startedAt = Date.now();
  stopwatchState.isRunning = true;
  stopwatchState.intervalId = window.setInterval(renderStopwatch, 250);
  elements.startStopwatch.textContent = "Pausar";
}

function lapStopwatch() {
  const elapsed = stopwatchState.isRunning
    ? stopwatchState.elapsedMs + (Date.now() - stopwatchState.startedAt)
    : stopwatchState.elapsedMs;

  if (elapsed === 0) {
    return;
  }

  stopwatchState.laps.unshift(formatStopwatch(elapsed));
  elements.lapList.innerHTML = stopwatchState.laps
    .map((lap, index) => `<li>Volta ${stopwatchState.laps.length - index}: ${lap}</li>`)
    .join("");
}

function resetStopwatch() {
  clearInterval(stopwatchState.intervalId);
  stopwatchState.intervalId = null;
  stopwatchState.isRunning = false;
  stopwatchState.elapsedMs = 0;
  stopwatchState.startedAt = 0;
  stopwatchState.laps = [];
  elements.startStopwatch.textContent = "Iniciar";
  elements.lapList.innerHTML = "";
  renderStopwatch();
}

elements.startPomodoro.addEventListener("click", startPomodoro);
elements.pausePomodoro.addEventListener("click", pausePomodoro);
elements.resetPomodoro.addEventListener("click", resetPomodoro);

elements.modeTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const settings = getSettings();
    pausePomodoro();
    if (button.dataset.mode === "focus") {
      pomodoroState.currentCycle = (pomodoroState.completedFocusSessions % settings.cyclesBeforeLongBreak) + 1;
    }
    syncPomodoroDuration(button.dataset.mode);
    updateStatus(`Modo ${MODES[button.dataset.mode].label.toLowerCase()} selecionado`);
  });
});

elements.settingsForm.addEventListener("input", applySettings);

elements.startStopwatch.addEventListener("click", startStopwatch);
elements.lapStopwatch.addEventListener("click", lapStopwatch);
elements.resetStopwatch.addEventListener("click", resetStopwatch);

renderPomodoro();
renderStopwatch();
