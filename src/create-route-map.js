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
export function createRouteMap(
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
  // 路径映射 {}
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // 名称映射 {}
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // 路由配置数组
  routes.forEach(route => {
    // 添加路由纪录
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // 确保通配符总是在最后
  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    // 匹配到开放路径，放到最后
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      // 从*位置重新开始，并且不需要判断*了
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

  // console.log(pathList,pathMap,nameMap);
  return {
    // 路径列表
    pathList,
    // 路径映射
    pathMap,
    // 名称映射
    nameMap
  }
}

/**
 * 添加路由记录
 * @param {*} pathList  路径列表
 * @param {*} pathMap  路径映射
 * @param {*} nameMap 名称映射
 * @param {*} route 路线
 * @param {*} parent 父路线记录
 * @param {*} matchAs
 */
function addRouteRecord(
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig, //
  parent?: RouteRecord,
  matchAs?: string
) {
  /**
   * 路线配置
   * path 路径
   * name 路由名称
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

  // 开放给配置的路径的正则
  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {}
  // 规范化路径
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

  // 是否大小写敏感
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 一条路线记录的所有信息
  const record: RouteRecord = {
    // 路径
    path: normalizedPath,
    // 路径规则
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    // 路线的组件，这里说明： 一条路线下是有多个router-view的，默认只有一个
    components: route.components || { default: route.component },
    // 实例
    instances: {},
    // 路线名称
    name,
    // 父路线
    parent,
    // 
    matchAs,
    // 重定向
    redirect: route.redirect,
    // 路线进入之前
    beforeEnter: route.beforeEnter,
    // 路线元数据
    meta: route.meta || {},
    // 路线属性
    props:
      route.props == null
        ? {}
        // 路线下有多个routerview视图
        : route.components
          ? route.props
          : { default: route.props }
  }

  // 路线下的子路线
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
      // 清理路径中的b//a//c => b/a/c
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      // 将嵌套的子路线,添加到pathList,pathMap,nameMap数组，对象中去
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // 给每个路径赋值为当前的路线记录对象，缓存到pathMap对象和pathList数组中
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  // 路线别名
  if (route.alias !== undefined) {
    // 将别名转换为数组，可以是多个别名，遍历别名执行添加路线记录
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
      // path alias作为地址使用时，处理相同
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

  // 路线名称
  if (name) {
    // 不存在
    if (!nameMap[name]) {
      // 给每个路线名称赋值为当前的路线对象
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

function compileRouteRegex(
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

/**
 * 规范化路径
 * @param {*} path 路线的路径
 * @param {*} parent 父路径
 * @param {*} strict 
 */
function normalizePath(
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  // 非严格下，将结尾的 / 替换为''
  if (!strict) path = path.replace(/\/$/, '')
  // 开头为/，为绝对路径，直接返回
  if (path[0] === '/') return path
  // 没有父路径，也直接返回
  if (parent == null) return path
  // 清理路径
  return cleanPath(`${parent.path}/${path}`)
}
