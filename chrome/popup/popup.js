const DEFAULTS = globalThis.ProcProConfig?.defaults ?? {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoCycle: true
};
const DEFAULT_BLOCKED_SITES = globalThis.ProcProConfig?.defaultBlockedSites ?? [];

const PHASE_LABELS = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break"
};

const toggle = document.getElementById("work-toggle");
const modeStatus = document.getElementById("mode-status");
const phaseStatus = document.getElementById("phase-status");
const timer = document.getElementById("timer");
const resetButton = document.getElementById("reset-timer");
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".panel"));
const blockedForm = document.getElementById("blocked-form");
const blockedInput = document.getElementById("blocked-input");
const blockedList = document.getElementById("blocked-list");
const settingsForm = document.getElementById("settings-form");
const resetSettingsButton = document.getElementById("reset-settings");
const focusMinutesInput = document.getElementById("focus-minutes");
const shortBreakMinutesInput = document.getElementById("short-break-minutes");
const longBreakMinutesInput = document.getElementById("long-break-minutes");
const sessionsBeforeLongBreakInput = document.getElementById("sessions-before-long-break");
const autoCycleToggle = document.getElementById("auto-cycle-toggle");

let liveState = null;
let timerIntervalId;

const sendMessage = (message) => chrome.runtime.sendMessage(message);

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
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

const renderBlockedSites = (blockedSites) => {
  blockedList.innerHTML = "";

  if (!blockedSites.length) {
    const empty = document.createElement("li");
    empty.className = "empty-message";
    empty.textContent = "No blocked domains yet.";
    blockedList.append(empty);
    return;
  }

  blockedSites.forEach((domain) => {
    const item = document.createElement("li");
    item.className = "blocked-item";
    const text = document.createElement("span");
    text.textContent = domain;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.domain = domain;
    button.textContent = "Remove";

    item.append(text, button);
    blockedList.append(item);
  });
};

const renderSettings = (settings) => {
  focusMinutesInput.value = settings.focusMinutes;
  shortBreakMinutesInput.value = settings.shortBreakMinutes;
  longBreakMinutesInput.value = settings.longBreakMinutes;
  sessionsBeforeLongBreakInput.value = settings.sessionsBeforeLongBreak;
  autoCycleToggle.setAttribute("aria-checked", String(settings.autoCycle));
};

const renderTimer = () => {
  if (!liveState) {
    timer.textContent = formatTime(DEFAULTS.focusMinutes * 60 * 1000);
    return;
  }

  if (!liveState.isWorkModeActive || !liveState.phaseEndAt) {
    timer.textContent = formatTime((liveState.settings?.focusMinutes ?? DEFAULTS.focusMinutes) * 60 * 1000);
    return;
  }

  timer.textContent = formatTime(liveState.phaseEndAt - Date.now());
};

const render = (state) => {
  liveState = state;

  document.body.classList.toggle("work-on", state.isWorkModeActive);
  toggle.setAttribute("aria-checked", String(state.isWorkModeActive));
  modeStatus.textContent = state.isWorkModeActive ? "Working" : "Ready";
  phaseStatus.textContent = PHASE_LABELS[state.phase] || "Focus";
  renderTimer();
  renderBlockedSites(state.blockedSites || []);
  renderSettings(state.settings || DEFAULTS);
};

const startTimerTicker = () => {
  stopTimerInterval();
  timerIntervalId = setInterval(async () => {
    if (!liveState?.isWorkModeActive || !liveState.phaseEndAt) {
      renderTimer();
      return;
    }

    renderTimer();

    if (liveState.phaseEndAt <= Date.now()) {
      const state = await sendMessage({ type: "GET_APP_STATE" });
      render(state);
    }
  }, 1000);
};

const refreshState = async () => {
  const state = await sendMessage({ type: "GET_APP_STATE" });
  render(state);
};

toggle.addEventListener("click", async () => {
  const shouldStart = toggle.getAttribute("aria-checked") !== "true";
  if (shouldStart) {
    await sendMessage({ type: "START_WORK_MODE" });
  } else {
    await sendMessage({ type: "STOP_WORK_MODE" });
  }
  await refreshState();
});

toggle.addEventListener("keydown", async (event) => {
  if (event.key !== " " && event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  toggle.click();
});

autoCycleToggle.addEventListener("click", () => {
  const isEnabled = autoCycleToggle.getAttribute("aria-checked") === "true";
  autoCycleToggle.setAttribute("aria-checked", String(!isEnabled));
});

autoCycleToggle.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  autoCycleToggle.click();
});

resetButton.addEventListener("click", async () => {
  await sendMessage({ type: "STOP_WORK_MODE" });
  await refreshState();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

blockedForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = blockedInput.value.trim();
  if (!domain) {
    return;
  }
  await sendMessage({ type: "ADD_BLOCKED_SITE", domain });
  blockedInput.value = "";
  await refreshState();
});

blockedList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-domain]");
  if (!button) {
    return;
  }
  await sendMessage({ type: "REMOVE_BLOCKED_SITE", domain: button.dataset.domain });
  await refreshState();
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = {
    focusMinutes: Number(focusMinutesInput.value || DEFAULTS.focusMinutes),
    shortBreakMinutes: Number(shortBreakMinutesInput.value || DEFAULTS.shortBreakMinutes),
    longBreakMinutes: Number(longBreakMinutesInput.value || DEFAULTS.longBreakMinutes),
    sessionsBeforeLongBreak: Number(sessionsBeforeLongBreakInput.value || DEFAULTS.sessionsBeforeLongBreak),
    autoCycle: autoCycleToggle.getAttribute("aria-checked") === "true"
  };
  await sendMessage({ type: "UPDATE_SETTINGS", settings });
  await refreshState();
});

resetSettingsButton.addEventListener("click", async () => {
  await sendMessage({
    type: "RESET_DEFAULTS",
    settings: DEFAULTS,
    blockedSites: DEFAULT_BLOCKED_SITES
  });
  await refreshState();
});

const init = async () => {
  await refreshState();
  startTimerTicker();
};

init();
