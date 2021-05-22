/* @flow */

import { _Vue } from '../install'
import { warn } from './warn'
import { isError } from '../util/errors'

/**
 * 解析异步组件，处理懒加载使用
 */
export function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
  // 目的线路 来源线路 下一个方法
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    /**
     * 组件实例 实例属性 线路 组件的key{default: <div> jmz </div>}
     */
    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        const resolve = once(resolvedDef => {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          match.components[key] = resolvedDef
          pending--
          if (pending <= 0) {
            next()
          }
        })

        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        let res
        try {
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          // 确定是Promise实例
          if (typeof res.then === 'function') {
            // 调用处理
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            const comp = res.component
            // 返回组件
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    if (!hasAsync) next()
  }
}

/**
 * 打平映射组件
 * @param {*} matched 匹配到的线路
 * @param {*} fn 回调
 * @return array 
 */
export function flatMapComponents (
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  // 将二维数组打平， 路线
  return flatten(matched.map(m => {
    // 同一个路由下的多个组件<router-view name="a"></router-view>
    // 
    return Object.keys(m.components).map(key => fn(
      // 组件实例
      m.components[key],
      // 组件实例
      m.instances[key],
      // 路由 key
      m, key
    ))
  }))
}

/**
 * 利用concat函数，将数组打平
 * @param {*} arr 
 */
export function flatten (arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}

// Symbol 类型是否可用
const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

  // 是否是es模块
function isESModule (obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once (fn) {
  // 利用闭包，来调用一次性的行为，下次的状态就为true，所以不会被再次调用了
  let called = false
  return function (...args) {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
