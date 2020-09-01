/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './state-key'

const positionStore = Object.create(null)

/**
 * 安装滚动
 */
export function setupScroll () {
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
  // window.location.protocol + '//' + window.location.host
  // location.host contains the port and location.hostname doesn't
  // 当前地址协议 // 地址主机/域名
  const protocolAndPath = window.location.protocol + '//' + window.location.host
  // https://abc/login => '/login'
  const absolutePath = window.location.href.replace(protocolAndPath, '')
  // 替换路径
  window.history.replaceState({ key: getStateKey() }, '', absolutePath)
  // 绑定popstate事件
  window.addEventListener('popstate', e => {
    saveScrollPosition()
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

/**
 * 处理滚动
 * @param {*} router 路由器实例
 * @param {*} to 去到哪个路线
 * @param {*} from 来自哪个路线
 * @param {*} isPop 是否弹出栈
 */
export function handleScroll (
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean
) {
  // 组件不存在
  if (!router.app) {
    return
  }

  // 路由器的选项属性 scrollBehavior
  const behavior = router.options.scrollBehavior
  // 没有设置
  if (!behavior) {
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  // 等待直到重新渲染完成开始滚动
  // 下一个周期开始
  router.app.$nextTick(() => {
    // 获取滚动位置
    const position = getScrollPosition()
    // 调用滚动配置的滚动方法
    const shouldScroll = behavior.call(
      // 路由器实例
      router,
      // 到哪个线路去
      to,
      // 从哪个线路来
      from,
      // 是否弹出栈
      isPop ? position : null
    )

    if (!shouldScroll) {
      return
    }

    // 返回的是一个Promise实例
    if (typeof shouldScroll.then === 'function') {
      // 调用执行
      shouldScroll
        .then(shouldScroll => {
          // 执行滚动方法
          scrollToPosition((shouldScroll: any), position)
        })
        .catch(err => {
          if (process.env.NODE_ENV !== 'production') {
            assert(false, err.toString())
          }
        })
    } else {
      // 不是Promise实例，直接执行
      scrollToPosition(shouldScroll, position)
    }
  })
}

// 保存位置信息
export function saveScrollPosition () {
  // 获取当前状态key，用来保存窗口位置信息
  const key = getStateKey()
  if (key) {
    // 添加位置信息
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

/**
 * 获取之前保存的位置信息，垂直偏移，水平偏移
 */
function getScrollPosition (): ?Object {
  // 获取当前保存窗口状态信息的key
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

/**
 * 获取元素位置信息
 * @param {*} el dom元素
 * @param {*} offset  偏移信息
 */
function getElementPosition (el: Element, offset: Object): Object {
  const docEl: any = document.documentElement
  // 获取根元素的位置信息，尺寸
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    // 距离指定元素的偏移量
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

// 验证位置数据是否合格
function isValidPosition (obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

// 规范化位置信息
function normalizePosition (obj: Object): Object {
  return {
    // 是否为数值， window.pageXOffset： 窗口距离浏览器左边框的距离（在左边为正，在右边为负）
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

/**
 * 规范化偏移量
 * @param {*} obj 偏移量对象
 */
function normalizeOffset (obj: Object): Object {
  return {
    // 是否为数值
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

function isNumber (v: any): boolean {
  return typeof v === 'number'
}

// id选择器
const hashStartsWithNumberRE = /^#\d/

/**
 * 滚动到指定位置
 * @param {*} shouldScroll 自定义滚动的配置对象
 * @param {*} position 
 */
function scrollToPosition (shouldScroll, position) {
  // shouldScroll是否是对象
  const isObject = typeof shouldScroll === 'object'
  // 是对象，selector属性未字符串，第一种是根据选中的元素指定位置
  if (isObject && typeof shouldScroll.selector === 'string') {
    // 如果选择器包含一个像#mian[data-attr]这样更复杂的查询，getElementById将会仍然失败
    // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
    // 但是同时，使用id和额外选择器选中元素不会更敏感
    // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
    // #jmz
    const el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
      ? document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line
      : document.querySelector(shouldScroll.selector)

      // dom元素存在
    if (el) {
      // 偏移量
      let offset =
        shouldScroll.offset && typeof shouldScroll.offset === 'object'
          ? shouldScroll.offset
          : {}
        // 规范偏移量
      offset = normalizeOffset(offset)
      // 获取元素的最终位置
      position = getElementPosition(el, offset)
      // 位置是否有效
    } else if (isValidPosition(shouldScroll)) {
      // 规范化位置信息
      position = normalizePosition(shouldScroll)
    }
    // 参数是否合格
  } else if (isObject && isValidPosition(shouldScroll)) {
    position = normalizePosition(shouldScroll)
  }
  // 配置了位置信息
  if (position) {
    window.scrollTo(position.x, position.y)
  }
}
