/* @flow */

/**
 * 解析路径
 * @param {*} relative 
 * @param {*} base 
 * @param {*} append 
 */
export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  // 如果是绝对路径的，直接返回
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    return relative
  }

  // 哈希，或者查询字符串
  if (firstChar === '?' || firstChar === '#') {
    // 直接，添加(url+path)返回
    return base + relative
  }

  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop()
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      stack.push(segment)
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('')
  }

  return stack.join('/')
}

/**
 * 解析路径
 * @param {*} path 
 */
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  // www.badi.com/page?name=34#jjj
  // {path: "www.badi.com/page", query: "name=34", hash: "#jjj"}
  return {
    path,
    query,
    hash
  }
}
/**
 * 将路径中的//转换为/
 */
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
