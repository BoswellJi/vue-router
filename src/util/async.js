/* @flow */
/**
 * 运行队列
 * @param {*} queue 导航守护队列
 * @param {*} fn 迭代器函数
 * @param {*} cb 回调
 */
export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    // 遍历完了
    if (index >= queue.length) {
      // 调用回调函数
      cb()
    } else {
      // 队列中有守护队列中存在路由守护，线执行守护在，执行回调路由执行
      if (queue[index]) { 
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
