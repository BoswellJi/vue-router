import View from './components/view'
import Link from './components/link'

export let _Vue

export function install (Vue) {
  // install方法属性,已经被安装,不再次安装
  if (install.installed && _Vue === Vue) return
  install.installed = true

  _Vue = Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    // 组件是否有父组件
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // Vue mixin,添加全局混入
  Vue.mixin({
    //
    beforeCreate () {
      // 已加入router:路由器实例
      // 只有根组件才有router
      if (isDef(this.$options.router)) {
        // 根组件
        this._routerRoot = this
        // 路由器
        this._router = this.$options.router
        // 初始化路由器
        // 传入组件实例
        this._router.init(this)
        // 定义响应式给根组
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      // 注册实例
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  // 给Vue构造函数添加原型属性,只读 路由器
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  // 路由规则
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 组测内部组件(路由视图与路由链接)
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
