
// a,继承b,单层对象
export function extend (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
