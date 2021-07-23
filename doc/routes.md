## 路线配置

```js
const router = {
   routes: [
    {
      path: '/', alias:'/root', name:'/name', component: Home, children: [
        {
          path: '/jmz', component: Home
        }
      ]
    }]
}
```

* path,alias,name: 代表一条route（线路）；
* path,alias作用相同；