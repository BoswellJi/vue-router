/* @flow */

import { warn } from './warn'

// 匹配！' () * 中的一个字符
const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = str =>
  encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ',')

export function decode (str: string) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `Error decoding "${str}". Leaving it intact.`)
    }
  }
  return str
}

/**
 * 解析query
 * @param {*} query 查询字符串
 * @param {*} extraQuery 额外查询字符串
 * @param {*} _parseQuery 解析查询字符串
 */
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
    const value = extraQuery[key]
    parsedQuery[key] = Array.isArray(value)
      ? value.map(castQueryParamValue)
      : castQueryParamValue(value)
  }
  return parsedQuery
}

const castQueryParamValue = value => (value == null || typeof value === 'object' ? value : String(value))

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
    const val = parts.length > 0 ? decode(parts.join('=')) : null

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

const url = resolveQuery('http%3A%2F%2Flocalhost%3A8080%2Fbasic%2Ffoo%3Fdelay%3D200');
console.log(url);

/**
 * 序列化query
 * @param {*} obj 
 */
export function stringifyQuery (obj: Dictionary<string>): string {
  const res = obj
    ? Object.keys(obj)
      .map(key => {
        const val = obj[key]

        if (val === undefined) {
          return ''
        }

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
      })
      .filter(x => x.length > 0)
      .join('&')
    : null
  return res ? `?${res}` : ''
}
