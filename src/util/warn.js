/* @flow */

/**
 * 断言
 * @param {*} condition 条件
 * @param {*} message 信息
 */
export function assert (condition: any, message: string) {
  // 没有条件
  if (!condition) {
    // 实例化Error构造函数
    throw new Error(`[vue-router] ${message}`)
  }
}

/**
 * 警告
 * @param {*} condition 条件
 * @param {*} message 信息
 */
export function warn (condition: any, message: string) {
  // 非生产环境 && 没有条件
  if (process.env.NODE_ENV !== 'production' && !condition) {
    // console对象存在 && 执行警告方法
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`)
  }
}

/**
 * 是否为Error构造函数
 * @param {*} err 
 */
export function isError (err: any): boolean {
  // 对象类型检查 [object Error]
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}

/**
 * 是否是继承Error类
 * @param {*} constructor 
 * @param {*} err 
 */
export function isExtendedError (constructor: Function, err: any): boolean {
  return (
    // 是NavigationDuplicated类的子类
    err instanceof constructor ||
    // 存在错误对象 && （错误实例的name == 构造函数name || 实例的_name == 构造函数的_name（所以这里是同一个构造函数的实例），说明是NavigationDuplicated类）
    // _name is to support IE9 too  _name还支持IE9
    (err && (err.name === constructor.name || err._name === constructor._name))
  )
}
