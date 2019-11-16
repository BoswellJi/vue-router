/* @flow */

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

  // 
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

  // 找到hash开始索引
  const hashIndex = path.indexOf('#')
  // 找到
  if (hashIndex >= 0) {
    // 获取路径上的hash
    hash = path.slice(hashIndex)
    // 获取路径
    path = path.slice(0, hashIndex)
  }

  // 找到路径上的查询字符串
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    // 获取查询字符串
    query = path.slice(queryIndex + 1)
    // 找到路径
    path = path.slice(0, queryIndex)
  }

  // 返回路径,查询字符串,hash值
  return {
    path,
    query,
    hash
  }
}
/**
 * 将路径中的//转换为/
 * @param {*} path  路径
 */
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
