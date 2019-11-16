/* @flow */

import { warn } from './warn'

// 匹配！' () * 中的一个字符
const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]，转义
// - preserve commas 分号

// 将字符串进行编码
const encode = str => encodeURIComponent(str)
  .replace(encodeReserveRE, encodeReserveReplacer)
  .replace(commaRE, ',')

const decode = decodeURIComponent

export function resolveQuery (
  query: ?string,
  extraQuery: Dictionary<string> = {},
  _parseQuery: ?Function
): Dictionary<string> {
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    // 解析查询参数
    parsedQuery = parse(query || '')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  // 将额外的查询参数合并到一起
  for (const key in extraQuery) {
    parsedQuery[key] = extraQuery[key]
  }
  return parsedQuery
}

function parseQuery (query: string): Dictionary<string> {
  const res = {}

  // ？ # &开头替换为空
  query = query.trim().replace(/^(\?|#|&)/, '')

  // 空查询
  if (!query) {
    return res
  }

  // 以&符号进行分割['a=b'  ]
  query.split('&').forEach(param => {
    // 先将 +替换为' ' 以等号进行分割
    const parts = param.replace(/\+/g, ' ').split('=')
    // 解码key
    const key = decode(parts.shift())

    // 如果数组元素大于0
    const val = parts.length > 0
    // 使用=进行连接
      ? decode(parts.join('='))
      : null

      // 配置解析的查询参数
    if (res[key] === undefined) {
      // 没有赋值
      res[key] = val
    } else if (Array.isArray(res[key])) {
      // 值为数组
      res[key].push(val)
    } else {
      // 同一个key，值放在数组
      res[key] = [res[key], val]
    }
  })

  return res
}

export function stringifyQuery (obj: Dictionary<string>): string {

  const res = obj ? Object.keys(obj).map(key => {
    const val = obj[key] //遍历obj

    // undefined当作空字符串返回
    if (val === undefined) {
      return ''
    }

    // null,
    if (val === null) {
      return encode(key)
    }

    if (Array.isArray(val)) {
      const result = []
      val.forEach(val2 => {
        if (val2 === undefined) {
          return
        }
        if (val2 === null) {
          result.push(encode(key))
        } else {
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      return result.join('&')
    }

    return encode(key) + '=' + encode(val)
  }).filter(x => x.length > 0).join('&') : null
  return res ? `?${res}` : ''
}
