const WORK_MODE_KEY = "isWorkModeActive";
const PHASE_KEY = "pomodoroPhase";
const PHASE_END_KEY = "pomodoroPhaseEndAt";
const SETTINGS_KEY = "pomodoroSettings";
const BLOCKED_SITES_KEY = "blockedSites";
const COMPLETED_SESSIONS_KEY = "completedFocusSessions";
const ALARM_NAME = "proproc-phase-alarm";

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoCycle: true,
  coneOfSilence: true,
  statusNotifications: true
};

const DEFAULT_BLOCKED_SITES = ["youtube.com", "instagram.com", "x.com", "tiktok.com"];

const getNotificationIconUrl = () => chrome.runtime.getURL("logo.png");
const getBlockedPageUrl = (site) =>
  `${chrome.runtime.getURL("blocked/blocked.html")}?site=${encodeURIComponent(site)}`;

const clearProcProNotifications = async () => {
  const notifications = await chrome.notifications.getAll();
  await Promise.all(Object.keys(notifications).map((id) => chrome.notifications.clear(id)));
};

const notify = async (title, message, settings) => {
  if (!settings.statusNotifications) {
    return;
  }

  try {
    if (settings.coneOfSilence) {
      await clearProcProNotifications();
    }

    await chrome.notifications.create({
      type: "basic",
      iconUrl: getNotificationIconUrl(),
      title,
      message
    });
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
};

const normalizeDomain = (value) => {
  const input = String(value || "").trim().toLowerCase();
  if (!input) {
    return "";
  }

  const withProtocol = /^https?:\/\//.test(input) ? input : `https://${input}`;

  try {
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const sanitizeSettings = (raw = {}) => {
  const focusMinutes = Number(raw.focusMinutes);
  const shortBreakMinutes = Number(raw.shortBreakMinutes);
  const longBreakMinutes = Number(raw.longBreakMinutes);
  const sessionsBeforeLongBreak = Number(raw.sessionsBeforeLongBreak);

  return {
    focusMinutes: Number.isFinite(focusMinutes) ? Math.max(1, Math.round(focusMinutes)) : DEFAULT_SETTINGS.focusMinutes,
    shortBreakMinutes: Number.isFinite(shortBreakMinutes)
      ? Math.max(1, Math.round(shortBreakMinutes))
      : DEFAULT_SETTINGS.shortBreakMinutes,
    longBreakMinutes: Number.isFinite(longBreakMinutes)
      ? Math.max(1, Math.round(longBreakMinutes))
      : DEFAULT_SETTINGS.longBreakMinutes,
    sessionsBeforeLongBreak: Number.isFinite(sessionsBeforeLongBreak)
      ? Math.max(1, Math.round(sessionsBeforeLongBreak))
      : DEFAULT_SETTINGS.sessionsBeforeLongBreak,
    autoCycle: raw.autoCycle ?? DEFAULT_SETTINGS.autoCycle,
    coneOfSilence: raw.coneOfSilence ?? DEFAULT_SETTINGS.coneOfSilence,
    statusNotifications: raw.statusNotifications ?? DEFAULT_SETTINGS.statusNotifications
  };
};

const getState = async () => {
  const stored = await chrome.storage.local.get([
    WORK_MODE_KEY,
    PHASE_KEY,
    PHASE_END_KEY,
    SETTINGS_KEY,
    BLOCKED_SITES_KEY,
    COMPLETED_SESSIONS_KEY
  ]);

  const settings = sanitizeSettings(stored[SETTINGS_KEY] || DEFAULT_SETTINGS);
  const blockedSitesSource = Array.isArray(stored[BLOCKED_SITES_KEY]) ? stored[BLOCKED_SITES_KEY] : DEFAULT_BLOCKED_SITES;
  const blockedSites = blockedSitesSource.map(normalizeDomain).filter(Boolean);

  return {
    isWorkModeActive: Boolean(stored[WORK_MODE_KEY]),
    phase: stored[PHASE_KEY] || "focus",
    phaseEndAt: Number(stored[PHASE_END_KEY]) || null,
    settings,
    blockedSites,
    completedFocusSessions: Number(stored[COMPLETED_SESSIONS_KEY]) || 0
  };
};

const getDurationMsForPhase = (phase, settings) => {
  if (phase === "focus") {
    return settings.focusMinutes * 60 * 1000;
  }

  if (phase === "shortBreak") {
    return settings.shortBreakMinutes * 60 * 1000;
  }

  return settings.longBreakMinutes * 60 * 1000;
};

const startPhase = async (phase, completedFocusSessions) => {
  const { settings } = await getState();
  const phaseEndAt = Date.now() + getDurationMsForPhase(phase, settings);

  await chrome.alarms.create(ALARM_NAME, { when: phaseEndAt });
  await chrome.storage.local.set({
    [WORK_MODE_KEY]: true,
    [PHASE_KEY]: phase,
    [PHASE_END_KEY]: phaseEndAt,
    [COMPLETED_SESSIONS_KEY]: completedFocusSessions
  });
};

const stopWorkMode = async () => {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({
    [WORK_MODE_KEY]: false,
    [PHASE_KEY]: "focus",
    [PHASE_END_KEY]: null,
    [COMPLETED_SESSIONS_KEY]: 0
  });
};

const advancePhase = async () => {
  const state = await getState();
  const { phase, settings, completedFocusSessions } = state;

  if (phase === "focus") {
    const nextCompleted = completedFocusSessions + 1;
    const isLongBreak = nextCompleted % settings.sessionsBeforeLongBreak === 0;
    const nextPhase = isLongBreak ? "longBreak" : "shortBreak";

    await notify("Focus done", isLongBreak ? "Great run. Take a long break." : "Nice work. Take a short break.", settings);

    if (!settings.autoCycle) {
      await stopWorkMode();
      return;
    }

    await startPhase(nextPhase, nextCompleted);
    return;
  }

  await notify("Break done", "Back to focus.", settings);

  if (!settings.autoCycle) {
    await stopWorkMode();
    return;
  }

  await startPhase("focus", completedFocusSessions);
};

const isBlockedUrl = (url, blockedSites) => {
  if (!url || url.startsWith(chrome.runtime.getURL("blocked/blocked.html"))) {
    return false;
  }

  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }

  return blockedSites.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
};

const enforceBlocking = async (tabId, url) => {
  const { isWorkModeActive, phase, blockedSites } = await getState();
  if (!isWorkModeActive || phase !== "focus" || !isBlockedUrl(url, blockedSites)) {
    return;
  }

  const domain = new URL(url).hostname.replace(/^www\./, "");
  await chrome.tabs.update(tabId, { url: getBlockedPageUrl(domain) });
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([SETTINGS_KEY, BLOCKED_SITES_KEY, WORK_MODE_KEY]);
  await chrome.storage.local.set({
    appName: "ProcPro",
    [SETTINGS_KEY]: sanitizeSettings(current[SETTINGS_KEY] || DEFAULT_SETTINGS),
    [BLOCKED_SITES_KEY]: Array.isArray(current[BLOCKED_SITES_KEY]) ? current[BLOCKED_SITES_KEY] : DEFAULT_BLOCKED_SITES,
    [WORK_MODE_KEY]: Boolean(current[WORK_MODE_KEY]),
    [PHASE_KEY]: "focus",
    [PHASE_END_KEY]: null,
    [COMPLETED_SESSIONS_KEY]: 0
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }

  enforceBlocking(tabId, changeInfo.url);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  await advancePhase();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    if (message.type === "GET_APP_STATE") {
      return getState();
    }

    if (message.type === "START_WORK_MODE") {
      await startPhase("focus", 0);
      const state = await getState();
      await notify(
        "Deep Work started",
        state.settings.coneOfSilence ? "Cone of Silence is active." : "Focus timer is running.",
        state.settings
      );
      return getState();
    }

    if (message.type === "STOP_WORK_MODE") {
      const state = await getState();
      await stopWorkMode();
      await notify("Work Mode stopped", "Focus session reset.", state.settings);
      return getState();
    }

    if (message.type === "UPDATE_SETTINGS") {
      const nextSettings = sanitizeSettings(message.settings || {});
      await chrome.storage.local.set({ [SETTINGS_KEY]: nextSettings });
      await notify("Settings saved", "Notification preferences updated.", nextSettings);
      return getState();
    }

    if (message.type === "RESET_DEFAULTS") {
      const nextSettings = sanitizeSettings(message.settings || DEFAULT_SETTINGS);
      const fallbackBlockedSites = Array.isArray(message.blockedSites) ? message.blockedSites : DEFAULT_BLOCKED_SITES;
      const nextBlockedSites = fallbackBlockedSites.map(normalizeDomain).filter(Boolean);

      await chrome.storage.local.set({
        [SETTINGS_KEY]: nextSettings,
        [BLOCKED_SITES_KEY]: nextBlockedSites.length ? nextBlockedSites : DEFAULT_BLOCKED_SITES
      });
      await notify("Defaults restored", "ProcPro settings are back to default.", nextSettings);
      return getState();
    }

    if (message.type === "ADD_BLOCKED_SITE") {
      const state = await getState();
      const nextDomain = normalizeDomain(message.domain);
      if (!nextDomain) {
        return getState();
      }

      const nextBlockedSites = Array.from(new Set([...state.blockedSites, nextDomain]));
      await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: nextBlockedSites });
      return getState();
    }

    if (message.type === "REMOVE_BLOCKED_SITE") {
      const state = await getState();
      const targetDomain = normalizeDomain(message.domain);
      const nextBlockedSites = state.blockedSites.filter((domain) => domain !== targetDomain);
      await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: nextBlockedSites });
      return getState();
    }

    return { ok: false };
  };

  run()
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("background message error", error);
      sendResponse({ ok: false, error: String(error) });
    });

  return true;
});
