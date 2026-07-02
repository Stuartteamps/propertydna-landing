// Toolbar-icon click → trigger the content script's extractor on the active tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__pdnaOpen && window.__pdnaOpen() });
  } catch (e) { /* page not injectable */ }
});
