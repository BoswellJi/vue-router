import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {

    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    const h = parent.$createElement
    const name = props.name
    // 父组件的线路实例
    const route = parent.$route
    // 路由器视图缓存
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    
    // 父组件 && 路由器根 !==父组件 
    // 首先实例化，根组件的routerview组件 （_routerRoot：根路由器组件）
    while (parent && parent._routerRoot !== parent) {
      // 获取父组件的vnode
      const vnodeData = parent.$vnode && parent.$vnode.data
      if (vnodeData) {
        // 存在routerview，深度++
        if (vnodeData.routerView) {
          depth++
        }
        // keepAlive && 
        if (vnodeData.keepAlive && parent._inactive) {
          inactive = true
        }
      }
      // 获取父组件的父组件
      parent = parent.$parent
    }
    // 路由器视图深度，嵌套几层routerview组件
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      return h(cache[name], data, children)
    }
    // 当前线路匹配到的路由，根据深度选择匹配额路由
    const matched = route.matched[depth]
    // render empty node if no matched route
    if (!matched) {
      cache[name] = null
      return h()
    }

    const component = cache[name] = matched.components[name]

    // attach instance registration hook 
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // vnode的hook,重写hook
    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance
      }
    }

    // resolve props
    let propsToPass = data.props = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      propsToPass = data.props = extend({}, propsToPass)
      // pass non-declared props as attrs
      const attrs = data.attrs = data.attrs || {}
      for (const key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }
    
    return h(component, data, children)
  }
}

/**
 * 解析属性,属性需要为对像格式
 * @param {*} route 
 * @param {*} config 
 */
function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}
