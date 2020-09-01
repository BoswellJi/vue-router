/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  constructor (router: Router, base: ?string) {
    super(router, base)

    // 获取配置的路由器滚动行为
    const expectScroll = router.options.scrollBehavior
    // 是否支持h5的history api 并且存在滚动行为
    const supportsScroll = supportsPushState && expectScroll

    // 调用
    if (supportsScroll) {
      setupScroll()
    }
    // 获取位置
    const initLocation = getLocation(this.base)
    // popstate事件
    window.addEventListener('popstate', e => {

      // 当前路线
      const current = this.current

      // 避免首次popstate触发在一些浏览器，但是首次历史路由没有更新，因为同时异步守护
      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }
      // 过渡下个页面
      this.transitionTo(location, route => {
        // 滚动处理
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go (n: number) {
    window.history.go(n)
  }

  /**
   * push路由
   * @param {*} location 跳转过去的地址
   * @param {*} onComplete 完成回调
   * @param {*} onAbort 废弃回调
   */
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // 当前线路，也就是从哪里来的线路
    const { current: fromRoute } = this
    // 跳转线路
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /**
   * 替换地址
   * @param {*} location 字符串/location对象
   * @param {*} onComplete 替换完成
   * @param {*} onAbort 替换失败
   */
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // 当前路线，向哪里去
    const { current: fromRoute } = this
    // 过渡跳转到下一个路线
    this.transitionTo(location, route => {
      // 过渡完成，替换路径
      replaceState(cleanPath(this.base + route.fullPath))
      // 
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /**
   * push 
   * @param {*} push 
   */
  ensureURL (push?: boolean) {
    // 获取当前根地址 !== 当前全路径
    if (getLocation(this.base) !== this.current.fullPath) {
      // 获取当前地址
      const current = cleanPath(this.base + this.current.fullPath)
      // push
      push ? pushState(current) : replaceState(current)
    }
  }

  /**
   * 获取当前位置
   */
  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}

/**
 * 获取当前位置
 * @param {*} base 基础路径
 */
export function getLocation (base: string): string {
  // http://www.baidu.com/abc

  // /abc/
  let path = decodeURI(window.location.pathname)
  // 当前地址路径是否是配置的基础路径
  if (base && path.indexOf(base) === 0) {
    // 取非base字符串部分
    path = path.slice(base.length)
  }
  // /abc/ + '' + ''
  return (path || '/') + window.location.search + window.location.hash
}
