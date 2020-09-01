/* @flow */
import { inBrowser } from './dom'

// use User Timing api (if present) for more accurate key precision
const Time =
  inBrowser && window.performance && window.performance.now
    ? window.performance
    : Date

// 当前时间毫秒数，保留三位小数, 生成状态key
export function genStateKey (): string {
  return Time.now().toFixed(3)
}

// 每次只会生成一次
let _key: string = genStateKey()

// 返回key
export function getStateKey () {
  return _key
}

// 重新设置key
export function setStateKey (key: string) {
  return (_key = key)
}
