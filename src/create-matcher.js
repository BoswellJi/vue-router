/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

/**
 * 创建匹配器
 * @param {*} routes 路由线路配置
 * @param {*} router 路由器实例
 */
export function createMatcher (
  routes: Array<RouteConfig>,  
  router: VueRouter  
): Matcher {
  // 创建路由映射，闭包来保存变量
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  /**
   * 添加路线
   * @param {*} routes 路由配置
   */
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  /**
   * 匹配到线路
   * @param {*} raw  将要跳转到的地址 /parent#/parent/foo
   * @param {*} currentRoute 当前线路信息
   * @param {*} redirectedFrom 
   */
  function match (
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location // url结构化
  ): Route {
    // 将要跳转到的地址，当前路线信息，false, 路由器
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location
    // 存在路线name
    if (name) {
      // 获取对应的路线详情
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 不存在，创建一个路线
      if (!record) return _createRoute(null, location)
      // 获取路由参数
      const paramNames = record.regex.keys
      // 不可选参数
        .filter(key => !key.optional)
        // 返回参数
        .map(key => key.name)

      // 路由参数不为对象,重新赋值为对象
      if (typeof location.params !== 'object') {
        location.params = {}
      }
      
      // 当前路由 && 
      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      location.path = fillParams(record.path, location.params, `named route "${name}"`)
      // 根据定义的下一个路由的record,与当前路由信息,进行和成新路线
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        // 匹配路线，成功后创建路线
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

  /**
   * 重定向
   * @param {*} record 
   * @param {*} location 
   */
  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect 
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  /**
   * 别名
   * @param {*} record 路线记录
   * @param {*} location 位置
   * @param {*} matchAs 
   */
  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
  
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  /**
   * 创建路线
   * @param {*} record 路线信息
   * @param {*} location 
   * @param {*} redirectedFrom 
   */
  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  // 根据跳转参数，匹配不同的线路，拿到线路中的信息
  return {
    match,
    addRoutes
  }
}

function matchRoute (
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  const m = path.match(regex)

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

/**
 * 解析记录中的路径
 * @param {*} path 
 * @param {*} record 
 */
function resolveRecordPath (path: string, record: RouteRecord): string {
  // 根据当前线路，向上找到父路线，形成一个完整的路径
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
