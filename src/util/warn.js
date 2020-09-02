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

