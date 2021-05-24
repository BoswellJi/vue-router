/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'
import { genStateKey, setStateKey, getStateKey } from './state-key'
import { extend } from './misc'

// 是否支持pushState方法
export const supportsPushState =
  // 浏览器中
  inBrowser &&
  (function () {
    const ua = window.navigator.userAgent

    // 判断用户代理排除，是android 2. 或者 android 4.0  并且
    if (
      (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1 &&
      ua.indexOf('Windows Phone') === -1
    ) {
      return false
    }

    return window.history && typeof window.history.pushState === 'function'
  })()

/**
 * 对历史记录进行操作
 */
export function pushState (url?: string, replace?: boolean) {
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state)
      stateCopy.key = getStateKey()
      // 替换，修改当前历史记录实体
      history.replaceState(stateCopy, '', url)
    } else {
      // 向当前浏览器会话的历史堆栈添加状态
      history.pushState({ key: setStateKey(genStateKey()) }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

/**
 * 替换状态，
 * @param {*} url
 */
export function replaceState (url?: string) {
  // 添加状态
  pushState(url, true)
}
