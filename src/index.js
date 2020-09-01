/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor(options: RouterOptions = {}) {
    this.app = null
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    // 创建路线匹配器
    this.matcher = createMatcher(options.routes || [], this)

    // 确定路由模式 hash || history
    let mode = options.mode || 'hash'
    // 设置了history路由模式，但是不支持
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false

    if (this.fallback) {
      mode = 'hash'
    }
    // 不在浏览器，服务器端
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode

    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  /**
   * 当前url信息和当前路线信息，进行匹配
   * @param {*} raw 地址
   * @param {*} current 
   * @param {*} redirectedFrom 
   */
  match(
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  /**
   * 获取当前路线
   */
  get currentRoute(): ?Route {
    return this.history && this.history.current
  }

  /**
   * 初始化
   * @param {*} app 组件实例
   */
  init(app: any /* Vue component instance */) {
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    // 添加当前组件实例
    this.apps.push(app)

    // set up app destroyed handler
    // https://github.com/vuejs/vue-router/issues/2639
    // 自定义事件监听
    app.$once('hook:destroyed', () => {
      // clean out app from this.apps array once destroyed
      const index = this.apps.indexOf(app)
      if (index > -1) this.apps.splice(index, 1)
      // ensure we still have a main app or null if no apps
      // we do not release the router so it can be reused
      if (this.app === app) this.app = this.apps[0] || null
    })

    // 主要app 预先初始化
    // main app previously initialized
    // 因为我们不需要安装新的 history 监听器
    // return as we don't need to set up new history listener
    if (this.app) {
      return
    }
    // 当前组件实例
    this.app = app

    // 不同的路由方案实例
    const history = this.history

    // html5方案
    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
      // hash方法
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(), // 传入当前地址
        setupHashListener, //
        setupHashListener
      )
    }

    // 监听历史记录
    history.listen(route => {
      // 遍历所有组件，给所有组件添加_route线路对象
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }

  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }

  onError(errorCb: Function) {
    this.history.onError(errorCb)
  }

  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.push(location, resolve, reject)
      })
    } else {
      this.history.push(location, onComplete, onAbort)
    }
  }

  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.replace(location, resolve, reject)
      })
    } else {
      this.history.replace(location, onComplete, onAbort)
    }
  }

  go(n: number) {
    this.history.go(n)
  }

  back() {
    this.go(-1)
  }

  forward() {
    this.go(1)
  }

  getMatchedComponents(to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  /**
   * 解析
   * @param {*} to 目的线路
   * @param {*} current 当前线路
   * @param {*} append 从后面添加
   */
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat 向后兼容
    normalizedTo: Location,
    resolved: Route
  } {
    // 当前线路
    current = current || this.history.current
    // 规范化位置
    const location = normalizeLocation(
      to,
      current,
      append,
      this
    )

    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  /**
   * 添加线路
   * @param {*} routes 路由配置
   */
  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    // 当前线路不是开始线路
    if (this.history.current !== START) {
      // 当前线路
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

/**
 * 注册hook
 * @param {*} list hook列表
 * @param {*} fn 
 */
function registerHook(list: Array<any>, fn: Function): Function {
  // 将hook添加到列表
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

/**
 * 创建超链接
 * @param {*} base 基础路径
 * @param {*} fullPath 全路径
 * @param {*} mode 模式
 */
function createHref(base: string, fullPath: string, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install
VueRouter.version = '__VERSION__'

// 浏览器环境下 && 全局变量Vue
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
