/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

// 序列化url
export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  // 地址为字符串,返回对象,否则返回自身
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  // 已经被序列化的,返回自身
  if (next._normalized) {
    return next
    // 有name的
  } else if (next.name) {
    // 拷贝新对象
    next = extend({}, raw)
    // 路由信息是否存在参数
    const params = next.params
    // 拷贝路由参数信息
    if (params && typeof params === 'object') {
      next.params = extend({}, params)
    }
    return next
  }

  // relative params
  // 没有路径，有参数，当前路线
  if (!next.path && next.params && current) {
    // 拷贝路由信息
    next = extend({}, next)
    // 标记已序列化
    next._normalized = true
    // 路线参数，拷贝参数信息
    const params: any = extend(extend({}, current.params), next.params)
    // 当前路线是否存在name
    if (current.name) {
      // 拷贝名称
      next.name = current.name
      // 拷贝参数
      next.params = params
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  // 获取路径的信息
  const parsedPath = parsePath(next.path || '')
  // 获取当前路线路径
  const basePath = (current && current.path) || '/'
  // 获取当前url中解析的路径
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

    // 当前url上的查询字符串,当前路线上的查询字符串
    // 
  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  // 
  let hash = next.hash || parsedPath.hash
  // 当前哈希第一个字符不是#,就添加上
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  /**
   * 到这里就序列化过了
   * 
   */
  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
