/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  /**
   * 构造函数
   * @param {*} router 路由实例
   * @param {*} base 基础路径
   * @param {*} fallback
   */
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    if (fallback && checkFallback(this.base)) {
      return
    }
    ensureSlash()
  }

  // 延迟直到app安装后，避免hashchange时间被太早触发
  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    // 是否配置滚动方法
    const expectScroll = router.options.scrollBehavior
    // 支持滚动 = 支持pushState方法 && 存在用户自定义滚动行为
    const supportsScroll = supportsPushState && expectScroll

    // 安装滚动
    if (supportsScroll) {
      this.listeners.push(setupScroll())
    }

    const handleRoutingEvent = () => {
      const current = this.current
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      })
    }
    const eventType = supportsPushState ? 'popstate' : 'hashchange'
    window.addEventListener(
      eventType,
      handleRoutingEvent
    )
    this.listeners.push(() => {
      window.removeEventListener(eventType, handleRoutingEvent)
    })
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) {
    window.history.go(n)
  }
  
  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  /**
   * 获取当前地址的hash字符串
   */
  getCurrentLocation () {
    return getHash()
  }
}

/**
 * 检查回退
 * @param {*} base 基础路径
 */
function checkFallback (base) {
  const location = getLocation(base)
  // 不存在 /#
  if (!/^\/#/.test(location)) {
    // 直接跳转
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

/**
 * 确保路径为绝对的
 * 原因： http://localhost:8080/scroll-behavior/#/bar，的hash为绝对路径，线路的路径
 */
function ensureSlash (): boolean {
  // 获取路径中的hash字符串
  const path = getHash()
  // 第一个字符是 /
  if (path.charAt(0) === '/') {
    return true
  }
  // 添加 / 变为绝对路径
  replaceHash('/' + path)
  return false
}

/**
 * 获取hash
 */
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  // 当前地址
  let href = window.location.href
  // #字符的索引
  const index = href.indexOf('#')
  // empty path
  // <0没有哈希
  if (index < 0) return ''
  // 获取hash字符串
  href = href.slice(index + 1)
  // decode the hash but not the search or hash
  // as search(query) is already decoded
  // https://github.com/vuejs/vue-router/issues/2708
  // hash存在查询字符串  name?age=12
  const searchIndex = href.indexOf('?')
  // hash中没有搜索信息
  if (searchIndex < 0) {
    // 获取#索引 'age=12#hah'
    const hashIndex = href.indexOf('#')
    // 找到了hash字符串
    if (hashIndex > -1) {
      href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
      // 没有hash字符串
    } else href = decodeURI(href)
  } else {
    href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
  }

  return href
}

/**
 * 获取url
 * @param {*} path
 */
function getUrl (path) {
  // 页面地址
  const href = window.location.href
  // hash字符串开始位置
  const i = href.indexOf('#')
  // 获取hash之前
  const base = i >= 0 ? href.slice(0, i) : href
  // 将地址作为hash进行添加
  return `${base}#${path}`
}

/**
 * 添加hash
 * @param {*} path
 */
function pushHash (path) {
  // 是否支持pushState方法
  if (supportsPushState) {
    // 添加新状态
    pushState(getUrl(path))
  } else {
    window.location.hash = path
  }
}

function replaceHash (path) {
  // 支持pushState方法
  if (supportsPushState) {
    // 替换当前路径的状态
    replaceState(getUrl(path))
  } else {
    window.location.replace(getUrl(path))
  }
}
