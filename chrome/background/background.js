chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ appName: "ProcPro" });
});

const WORK_MODE_KEY = "isWorkModeActive";
const TIMER_END_KEY = "focusTimerEndAt";
const FOCUS_ALARM = "focus-flow-complete";

const clearFocusTimer = async () => {
  await chrome.alarms.clear(FOCUS_ALARM);
  await chrome.storage.local.set({
    [WORK_MODE_KEY]: false,
    [TIMER_END_KEY]: null
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_FOCUS_TIMER") {
    chrome.storage.local
      .set({
        [WORK_MODE_KEY]: true,
        [TIMER_END_KEY]: message.endAt
      })
      .then(() => chrome.alarms.create(FOCUS_ALARM, { when: message.endAt }))
      .then(() => sendResponse({ ok: true }));

    return true;
  }

  if (message.type === "STOP_FOCUS_TIMER") {
    clearFocusTimer().then(() => sendResponse({ ok: true }));

    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== FOCUS_ALARM) {
    return;
  }

  clearFocusTimer().then(() => {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "logo.png",
      title: "Focus Flow complete",
      message: "Nice work. Take a short break."
    });
  });
});
