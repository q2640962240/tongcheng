import { createRouter, createWebHistory } from 'vue-router'

const Layout = () => import('../components/Layout.vue')

const routes = [
  {
    path: '/login',
    component: () => import('../views/login/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/users/Users.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('../views/services/Services.vue'),
        meta: { title: '服务管理', icon: 'Goods' }
      },
      {
        path: 'services/categories',
        name: 'ServiceCategories',
        component: () => import('../views/services/Categories.vue'),
        meta: { title: '服务分类管理', icon: 'Menu' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../views/orders/Orders.vue'),
        meta: { title: '订单管理', icon: 'List' }
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('../views/finance/Finance.vue'),
        meta: { title: '财务管理', icon: 'Wallet' }
      },
      {
        path: 'finance/elite-orders',
        name: 'EliteOrders',
        component: () => import('../views/finance/EliteOrders.vue'),
        meta: { title: '精英订单', icon: 'Medal' }
      },
      {
        path: 'invite',
        name: 'InviteAdmin',
        component: () => import('../views/invite/Invite.vue'),
        meta: { title: '邀请管理', icon: 'Share' }
      },
      {
        path: 'content',
        name: 'Content',
        component: () => import('../views/content/Content.vue'),
        meta: { title: '内容管理', icon: 'Document' }
      },
      {
        path: 'discover/posts',
        name: 'DiscoverPosts',
        component: () => import('../views/discover/Posts.vue'),
        meta: { title: '动态管理', icon: 'ChatDotRound' }
      },
      {
        path: 'discover/groups',
        name: 'DiscoverGroups',
        component: () => import('../views/discover/Groups.vue'),
        meta: { title: '组局管理', icon: 'UserFilled' }
      },
      {
        path: 'operations/banners',
        name: 'OperationsBanners',
        component: () => import('../views/operations/Banners.vue'),
        meta: { title: 'Banner 管理', icon: 'PictureFilled' }
      },
      {
        path: 'auth/certifications',
        name: 'Certifications',
        component: () => import('../views/auth/Certifications.vue'),
        meta: { title: '认证管理', icon: 'Key' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/settings/Settings.vue'),
        meta: { title: '配置中心', icon: 'Setting' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '管理后台'} - 白夜`
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
