/* @flow */
/**
 * 运行队列
 */
export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    if (index >= queue.length) {
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
