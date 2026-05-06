const STORAGE_KEY = "isWorkModeActive";

const toggle = document.getElementById("work-toggle");
const status = document.getElementById("mode-status");
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".panel"));

const setModeUi = (isWorkModeActive) => {
  document.body.classList.toggle("work-on", isWorkModeActive);
  toggle.checked = isWorkModeActive;
  status.textContent = isWorkModeActive ? "Working" : "Browsing";
};

const setActiveTab = (tabName) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
};

const loadInitialMode = async () => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const isWorkModeActive = Boolean(result[STORAGE_KEY]);
  setModeUi(isWorkModeActive);
};

const saveMode = async (isWorkModeActive) => {
  await chrome.storage.local.set({ [STORAGE_KEY]: isWorkModeActive });
};

toggle.addEventListener("change", async (event) => {
  const isWorkModeActive = event.target.checked;
  setModeUi(isWorkModeActive);
  await saveMode(isWorkModeActive);
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
  });
});

loadInitialMode();

