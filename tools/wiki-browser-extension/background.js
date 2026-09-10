/* global chrome */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (new URL(tab.url).origin !== 'https://wiki.venor2.hu') {
      await chrome.action.setBadgeText({ tabId: tab.id, text: 'WIKI' })
      await chrome.action.setTitle({ tabId: tab.id, title: 'Open wiki.venor2.hu in this tab first' })
      return
    }
    const { collectorTab } = await chrome.storage.session.get('collectorTab')
    if (collectorTab && collectorTab !== tab.id) {
      const previous = await chrome.tabs.get(collectorTab).catch(() => null)
      if (previous?.url?.startsWith('https://wiki.venor2.hu/')) {
        await chrome.tabs.update(collectorTab, { active: true })
        await chrome.windows.update(previous.windowId, { focused: true })
        return
      }
    }
    await chrome.storage.session.set({ collectorTab: tab.id })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['collector.js'] })
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' })
  } catch (error) {
    console.error('Wiki exporter:', error)
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'ERR' })
    await chrome.action.setTitle({ tabId: tab.id, title: error.message })
  }
})
