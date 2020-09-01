/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
/**
 * 正则编译缓存
 */
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

/**
 * 填充 参数
 * @param {*} path 路径
 * @param {*} params 查询参数
 * @param {*} routeMsg 线路信息
 */
export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  params = params || {}
  try {
    // 将路径规则编译为正则表达式进行缓存
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // 匹配参数
    if (params.pathMatch) params[0] = params.pathMatch
    // 使用参数，替换表达式中参数
    return filler(params, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  } finally {
    // delete the 0 if it was added 0 属性
    delete params[0]
  }
}
