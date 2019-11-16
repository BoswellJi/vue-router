/* @flow */

export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    // 大于等于队列长度(索引)
    if (index >= queue.length) {
      // 
      cb()
    } else {
      // 队列中有，
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        // 下一步
        step(index + 1)
      }
    }
  }
  step(0)
}
