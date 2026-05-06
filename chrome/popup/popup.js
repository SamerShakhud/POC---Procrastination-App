const WORK_MODE_KEY = "isWorkModeActive";
const TIMER_END_KEY = "focusTimerEndAt";
const FOCUS_DURATION_MINUTES = globalThis.ProcProConfig?.focusDurationMinutes ?? 25;
const FOCUS_DURATION_MS = FOCUS_DURATION_MINUTES * 60 * 1000;

const toggle = document.getElementById("work-toggle");
const status = document.getElementById("mode-status");
const timer = document.getElementById("timer");
const resetButton = document.getElementById("reset-timer");
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".panel"));

let timerIntervalId;

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
};

const setTimerUi = (endAt) => {
  if (!endAt) {
    timer.textContent = formatTime(FOCUS_DURATION_MS);
    return;
  }

  timer.textContent = formatTime(endAt - Date.now());
};

const setModeUi = (isWorkModeActive, endAt) => {
  document.body.classList.toggle("work-on", isWorkModeActive);
  toggle.checked = isWorkModeActive;
  status.textContent = isWorkModeActive ? "Focusing" : "Ready";
  setTimerUi(endAt);
};

const setActiveTab = (tabName) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
};

const stopTimerInterval = () => {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = undefined;
  }
};

const startTimerInterval = (endAt) => {
  stopTimerInterval();
  setTimerUi(endAt);

  timerIntervalId = setInterval(() => {
    const remainingMs = endAt - Date.now();
    setTimerUi(endAt);

    if (remainingMs <= 0) {
      stopTimerInterval();
      setModeUi(false);
    }
  }, 1000);
};

const loadInitialMode = async () => {
  const result = await chrome.storage.local.get([WORK_MODE_KEY, TIMER_END_KEY]);
  const isWorkModeActive = Boolean(result[WORK_MODE_KEY]);
  const endAt = result[TIMER_END_KEY];

  if (isWorkModeActive && endAt <= Date.now()) {
    await stopFocusSession();
    return;
  }

  setModeUi(isWorkModeActive, endAt);

  if (isWorkModeActive && endAt) {
    startTimerInterval(endAt);
  }
};

const startFocusSession = async () => {
  const endAt = Date.now() + FOCUS_DURATION_MS;
  await chrome.runtime.sendMessage({ type: "START_FOCUS_TIMER", endAt });
  setModeUi(true, endAt);
  startTimerInterval(endAt);
};

const stopFocusSession = async () => {
  await chrome.runtime.sendMessage({ type: "STOP_FOCUS_TIMER" });
  stopTimerInterval();
  setModeUi(false);
};

toggle.addEventListener("change", async (event) => {
  const isWorkModeActive = event.target.checked;

  if (isWorkModeActive) {
    await startFocusSession();
  } else {
    await stopFocusSession();
  }
});

resetButton.addEventListener("click", async () => {
  await stopFocusSession();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
  });
});

loadInitialMode();
