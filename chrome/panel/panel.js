const DEFAULTS = globalThis.ProcProConfig?.defaults ?? {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoCycle: true,
  coneOfSilence: true,
  statusNotifications: true
};

const PHASE_LABELS = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break"
};

const modeStatus = document.getElementById("mode-status");
const phaseStatus = document.getElementById("phase-status");
const timer = document.getElementById("timer");
const workToggle = document.getElementById("work-toggle");

let liveState = null;
let timerIntervalId;

const sendMessage = (message) => chrome.runtime.sendMessage(message);

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const renderTimer = () => {
  if (!liveState?.isWorkModeActive || !liveState?.phaseEndAt) {
    timer.textContent = formatTime((liveState?.settings?.focusMinutes ?? DEFAULTS.focusMinutes) * 60 * 1000);
    return;
  }
  timer.textContent = formatTime(liveState.phaseEndAt - Date.now());
};

const render = (state) => {
  liveState = state;
  workToggle.setAttribute("aria-checked", String(state.isWorkModeActive));
  modeStatus.textContent = state.isWorkModeActive ? "Working" : "Ready";
  phaseStatus.textContent = PHASE_LABELS[state.phase] || "Focus";
  renderTimer();
};

const refreshState = async () => {
  const state = await sendMessage({ type: "GET_APP_STATE" });
  render(state);
};

const startTicker = () => {
  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(async () => {
    renderTimer();
    if (liveState?.phaseEndAt && liveState.phaseEndAt <= Date.now()) {
      await refreshState();
    }
  }, 1000);
};

workToggle.addEventListener("click", async () => {
  const shouldStart = workToggle.getAttribute("aria-checked") !== "true";
  await sendMessage({ type: shouldStart ? "START_WORK_MODE" : "STOP_WORK_MODE" });
  await refreshState();
});

workToggle.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  workToggle.click();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes.pomodoroPhase || changes.pomodoroPhaseEndAt || changes.pomodoroSettings || changes.isWorkModeActive) {
    refreshState();
  }
});

const init = async () => {
  await refreshState();
  startTicker();
};

init();
