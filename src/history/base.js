/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError, isExtendedError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import { NavigationDuplicated } from './errors'

export class History {
  router: Router
  base: string
  current: Route
  pending: ?Route
  cb: (r: Route) => void
  ready: boolean
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>

  // implemented by sub-classes
  +go: (n: number) => void
  +push: (loc: RawLocation) => void
    +replace: (loc: RawLocation) => void
      +ensureURL: (push?: boolean) => void
        +getCurrentLocation: () => string

/**
* 路由实例
* 路由根路径
*/
constructor(router: Router, base: ?string) {
  this.router = router
  this.base = normalizeBase(base)
  // start with a route object that stands for "nowhere"
  // 当前路线
  this.current = START
  this.pending = null
  this.ready = false
  this.readyCbs = []
  this.readyErrorCbs = []
  this.errorCbs = []
}

// 监听函数
listen(cb: Function) {
  this.cb = cb
}

// 准备
onReady(cb: Function, errorCb: ?Function) {
  if (this.ready) {
    cb()
  } else {
    this.readyCbs.push(cb)
    if (errorCb) {
      this.readyErrorCbs.push(errorCb)
    }
  }
}

// 错误
onError(errorCb: Function) {
  this.errorCbs.push(errorCb)
}

/**
 * 路由切换
 * @param {} /parent#/parent/foo 原生的地址 url信息,想要跳转过去的线路
 * @param onComplete
 * @param onAbort
 */
transitionTo( 
  location: RawLocation,
  onComplete ?: Function,
  onAbort ?: Function
) {
  // 匹配到要跳转的路径，根据当前原生地址和当前路由，匹配到路线信息
  const route = this.router.match(location, this.current)
  // 下一步就是跳转到这个路径了
  this.confirmTransition(
    route,
    () => {
      // 完成跳转，更新当前路由的信息
      this.updateRoute(route)
      // 调用当前完成的回调
      onComplete && onComplete(route)
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => {
          cb(route)
        })
      }
    },
    err => {
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => {
          cb(err)
        })
      }
    }
  )
}

/**
 * 提示过度,路线
 * @param route 路线
 * @param onComplete 完成
 * @param onAbort 完成
 */
confirmTransition(route: Route, onComplete: Function, onAbort ?: Function) {
  // 获取当前路由
  const current = this.current
  // 路由跳转被废弃
  const abort = err => {
    // 合并 pr 之后，当用户导航穿过历史通过back/forward按钮时，
    // after merging https://github.com/vuejs/vue-router/pull/2771 we
    // When the user navigates through history through back/forward buttons
    // 我们不想仍出错误，如果直接调用push/replace方法，我们只会扔出他
    // we do not want to throw the error. We only throw it if directly calling
    // 那是为什么他没有被包含在is错误中
    // push/replace. That's why it's not included in isError

    // 判断err，是否继承自NavigationDuplicated构造函数 && err是否为Error实例
    if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {
      // 错误回调函数数组
      if (this.errorCbs.length) {
        // 遍历执行
        this.errorCbs.forEach(cb => {
          cb(err)
        })
      } else {
        // 路由导航期间未捕获的错误
        warn(false, 'uncaught error during route navigation:')
        console.error(err)
      }
    }
    onAbort && onAbort(err)
  }
  // 下一个路线与当前是同一个,丢弃导航
  if (
    isSameRoute(route, current) &&
    // 已经被动态添加的路由映射
    // in the case the route map has been dynamically appended to
    route.matched.length === current.matched.length
  ) { 
    this.ensureURL()
    // 放弃导航
    return abort(new NavigationDuplicated(route))
  }

  // 获取路由状态
  const { updated, deactivated, activated } = resolveQueue(
    // 被匹配到的路线
    this.current.matched,
    route.matched
  )

  // 路由守护队列，获取组件的守护队列
  const queue: Array<?NavigationGuard> = [].concat(
    // 离开组件 beforeRouteLeave
    // in-component leave guards
    extractLeaveGuards(deactivated),
    // 全局钩子之前 ‘beforeEach’
    // global before hooks
    this.router.beforeHooks,
    // 组件中的更新钩子 beforeRouteUpdate
    // in-component update hooks
    extractUpdateHooks(updated),
    // 在路由器的配置中
    // { path: '/qux', component: Qux, beforeEnter(){ console.log(123) }}
    // in-config enter guards
    activated.map(m => m.beforeEnter),
    // async components
    resolveAsyncComponents(activated)
  )
  // 正在等待
  this.pending = route
  const iterator = (hook: NavigationGuard, next) => {
    // 非等待状态，即，路由状态废弃，调用废弃的回调函数
    if (this.pending !== route) {
      return abort()
    }
    try {
      // 路由实例的钩子函数
      hook(route, current, (to: any) => {
        if (to === false || isError(to)) {
          // next(false) -> abort navigation, ensure current URL
          this.ensureURL(true)
          abort(to)
        } else if (
          typeof to === 'string' ||
          (typeof to === 'object' &&
            (typeof to.path === 'string' || typeof to.name === 'string'))
        ) {
          // next('/') or next({ path: '/' }) -> redirect
          abort()
          if (typeof to === 'object' && to.replace) {
            this.replace(to)
          } else {
            this.push(to)
          }
        } else {
          // confirm transition and pass on the value
          next(to)
        }
      })
    } catch (e) {
      abort(e)
    }
  }

  /**
   * 1. 验证路由的函数
   */
  runQueue(queue, iterator, () => {
    const postEnterCbs = []
    // 当前路由是否有效
    const isValid = () => this.current === route
    // 提取组件内守护之前，等待直到异步组件被解析
    // wait until async components are resolved before
    // extracting in-component enter guards
    const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
    // 进入路由时的守护任务，
    const queue = enterGuards.concat(this.router.resolveHooks)
    // 再次线执行守护任务
    runQueue(queue, iterator, () => {
      // 当前线路被废弃
      if (this.pending !== route) {
        return abort()
      }
      // 跳转路由完成
      this.pending = null
      // 执行成功回调
      onComplete(route)
      // 当前组件的实例
      if (this.router.app) {
        // 下个周期执行
        this.router.app.$nextTick(() => {
          postEnterCbs.forEach(cb => {
            cb()
          })
        })
      }
    })
  })
}

/**
 * 更新当前的路线
 * @param {} route 下一条线路
 */
updateRoute(route: Route) {
  // 更新路由
  const prev = this.current
  this.current = route
  this.cb && this.cb(route)
  // 调用路由切换钩子函数
  this.router.afterHooks.forEach(hook => {
    hook && hook(route, prev)
  })
}
}

/**
 * 规范化路径
 * @param {*} base
 */
function normalizeBase(base: ?string): string {
  // 没有配置
  if (!base) {
    // 浏览器中
    if (inBrowser) {
      // respect <base> tag
      // 获取base标签的根路径配置
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin 将https://fg
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      // 默认为空
      base = '/'
    }
  }
  // make sure there's the starting slash
  // 根路径
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

/**
 * 解析队列
 * @param {*} current 当前路线
 * @param {*} next 下一个路线
 */
function resolveQueue(
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  // 长度
  const max = Math.max(current.length, next.length)
  // 查找哪部分开始不同
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    // 更新线路，切换参数
    updated: next.slice(0, i),
    // 活跃线路
    activated: next.slice(i),
    // 废弃线路
    deactivated: current.slice(i)
  }
}

/**
 * 提取守护
 * @param {*} records 路线记录
 * @param {*} name 路由守护钩子名称
 * @param {*} bind 绑定
 * @param {*} reverse 反转
 */
function extractGuards(
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  // 打平组件， 组件实例，组件实例，线路实例，路径下的组件名称
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    // 获取到的守护方法
    const guard = extractGuard(def, name)
    // 存在
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        // 组件实例 线路实例 
        : bind(guard, instance, match, key)
    }
  })
  return flatten(reverse ? guards.reverse() : guards)
}

/**
 * 提取守护
 * @param {*} def 组件实例
 * @param {*} key 路由守护钩子名称
 */
function extractGuard(
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // 现在继承为的是全局mixins被使用
    // extend now so that global mixins are applied.
    // 继承组件
    def = _Vue.extend(def)
  }
  // 返回组件选中的对应的
  return def.options[key]
}

/**
 * 提取组件离开的验证
 * @param {*} deactivated 不活跃的路线
 */
function extractLeaveGuards(deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

// 提取路由更新
function extractUpdateHooks(updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard(guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  // 组件实例存在
  if (instance) {
    // 调用这个守护
    return function boundRouteGuard() {
      return guard.apply(instance, arguments)
    }
  }
}

/**
 * 提取进行收入
 * @param {*} activated 活跃路线
 * @param {*} cbs 
 * @param {*} isValid 
 */
function extractEnterGuards(
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  // 进入路由之前的守护
  return extractGuards(
    activated,
    'beforeRouteEnter',
    // 
    (guard, _, match, key) => {
      // 守护方法 线路 
      return bindEnterGuard(guard, match, key, cbs, isValid)
    }
  )
}

/**
 * 绑定进入守护
 * @param {*} guard 路由守护方法
 * @param {*} match 路线记录
 * @param {*} key 路径组件名
 * @param {*} cbs 回调
 * @param {*} isValid 
 */
function bindEnterGuard(
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard(to, from, next) {
    // 调用守护完成后执行next，下一个路由
    return guard(to, from, cb => {
      if (typeof cb === 'function') {
        // 
        cbs.push(() => {
          // #750
          // 如果router-view被使用淡出-淡入的tranistion包裹
          // if a router-view is wrapped with an out-in transition,
          // 实例不可能被同时注册
          // the instance may not have been registered at this time.
          // 我们会需要poll来注册，直到当前路由不再验证
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
      next(cb)
    })
  }
}

/**
 * 池子
 * @param {*} cb 回调函数
 * @param {*} instances 组件实例
 * @param {*} key 组件名称
 * @param {*} isValid 
 */
function poll(
  cb: any, // somehow flow cannot infer this is a function，flow不能推导这个是一个函数
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (
    // 实例
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
