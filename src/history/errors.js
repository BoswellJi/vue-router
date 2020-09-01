
/**
 * 导航废弃，
 * Error：原生的对象
 */
export class NavigationDuplicated extends Error {
  /**
   * 构造函数
   * @param {*} normalizedLocation 规范的本地
   */
  constructor (normalizedLocation) {
    super()
    // 给类添加属性
    this.name = this._name = 'NavigationDuplicated'
    // 传递信息到父类不能看 工作在转换的版本
    // passing the message to super() doesn't seem to work in the transpiled version
    // 不允许导航到当前位置
    this.message = `Navigating to current location ("${
      normalizedLocation.fullPath
    }") is not allowed`
    // 添加stack属性所以像Sentry的服务能够正确展示它
    // add a stack property so services like Sentry can correctly display it
    Object.defineProperty(this, 'stack', {
      value: new Error().stack,
      writable: true,
      configurable: true
    })
    // 我们还能使用，Error类的静态方法captureStackTrace():捕获栈追踪
    // we could also have used
    // Error.captureStackTrace(this, this.constructor)
    // 但是它只存在节点合chrome上
    // but it only exists on node and chrome
  }
}

// support IE9
// 添加静态属性
NavigationDuplicated._name = 'NavigationDuplicated'
