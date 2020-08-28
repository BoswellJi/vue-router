/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/**
 * 将路由配置转换成路由映射表
 * @param {*} routes  路由规则
 * @param {*} oldPathList
 * @param {*} oldPathMap
 * @param {*} oldNameMap
 */
export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // the path list is used to control path matching priority(权重)
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  // 路径映射 /a
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // 名称映射 a
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  /**
    const routes = [
      { path: '/foo', name:'foo', component: Foo },
      { path: '/bar', name:'bar', component: Bar }
    ]
   */
  routes.forEach(route => {
    // 添加路由纪录
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    // 匹配到开放路径，放到最后
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

/**
 * 添加路由记录
 * @param {*} pathList  路径列表
 * @param {*} pathMap  路径映射到路径纪录
 * @param {*} nameMap 名称映射到路径纪录
 * @param {*} route 路线
 * @param {*} parent 父路径
 * @param {*} matchAs
 */
function addRouteRecord (
  pathList: Array<string>,  // 路径列表
  pathMap: Dictionary<RouteRecord>, // 路径映射
  nameMap: Dictionary<RouteRecord>, // name映射
  route: RouteConfig, //
  parent?: RouteRecord,
  matchAs?: string
) {
  /**
   * 路线配置
   * path
   * name
   */
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  // 开放给配置
  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {}
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

  // 是否大小写敏感
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 一条路由记录的所有信息
  const record: RouteRecord = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props }
  }

  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      /** 路线有名称，但是没有重定向名称，子路线 */
      if (
        route.name &&
        !route.redirect &&
        // 有/零个或者1个，（路由名称导航，默认不渲染子组件
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        )
      }
    }

    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
        // 将嵌套的子路线，处理到父路由同级
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  /**
   * routerConfig
   * [
   *   {path:'/a',name:'a',components:a,childrend:[{ path:'/b',name:'b',components:b }]}
   * ]
   *
   *  pathList
   * [
   *    '/a',
   *    '/a/b'
   * ]
   *
   * pathMap
   * {
   *  '/a':{path:'/a'},
   *  '/a/b':{path:'/a/b'}
   * }
   */
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  // 路线别名
  if (route.alias !== undefined) {
    // 将别名转换为数组
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      // 别名不能根路径相同
      if (process.env.NODE_ENV !== 'production' && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }

      // 根据别名配置路线信息与路径相同处理
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    }
  }

  /**
   * 路线有name
   * {
   *   'a':{path:'/a'}
   * }
   */
  if (name) {
    // 不存在
    if (!nameMap[name]) {
      // 添加
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    // 路由参数
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  // 非严格下，将/ 替换为''
  if (!strict) path = path.replace(/\/$/, '')

  if (path[0] === '/') return path
  if (parent == null) return path
  //
  return cleanPath(`${parent.path}/${path}`)
}
