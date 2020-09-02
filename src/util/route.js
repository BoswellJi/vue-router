/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

// /?
const trailingSlashRE = /\/?$/

/**
 * 根据url信息，路线纪录，创建路线
 * @param {*} record
 * @param {*} location
 * @param {*} redirectedFrom
 * @param {*} router
 */
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    query = clone(query)
  } catch (e) {}

  // 路线对象字段
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query, 
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  }
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route)
}

function clone (value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {}
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// 代表初始状态的开始路线
// the starting route that represents the initial state
export const START = createRoute(null, {
  path: '/'
})

/**
 * 整条路线的节点，子-》父
 * @param {*} record
 */
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    res.unshift(record)
    // 找到父节点
    record = record.parent
  }
  return res
}

/**
 * 获取全路径
 * @param {*} param0 路径，查询参数，哈希
 * @param {*} _stringifyQuery 序列化查询参数
 */
function getFullPath (
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  // 
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

/**
 * 是否是相同的路线（当前的和下一个
 * @param {*} a 下一个
 * @param {*} b 当前
 */
export function isSameRoute (a: Route, b: ?Route): boolean {
  // 开始路线
  if (b === START) {
    return a === b
    // 当前没有路由
  } else if (!b) {
    return false
    // 都存在path，说明是在切换
  } else if (a.path && b.path) {
    // 
    return (
      // 路径相同
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      // hash相同
      a.hash === b.hash &&
      // 查询字符串相同
      isObjectEqual(a.query, b.query)
    )
    // name相同
  } else if (a.name && b.name) {
    return (
      // 名称相同
      a.name === b.name &&
      // hash相同
      a.hash === b.hash &&
      // 查询子符串
      isObjectEqual(a.query, b.query) &&
      // 参数
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

function isObjectEqual (a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // query values can be null and undefined
    if (aVal == null || bVal == null) return aVal === bVal
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
