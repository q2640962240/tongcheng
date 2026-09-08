<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '232px'" class="sidebar">
      <div class="logo">
        <div class="logo-icon">白</div>
        <span v-show="!isCollapse" class="logo-text">白夜后台</span>
      </div>
      <div class="menu-scroll">
        <el-menu
          :default-active="activeMenu"
          :default-openeds="defaultOpeneds"
          :collapse="isCollapse"
          :collapse-transition="false"
          router
          background-color="#0e1020"
          text-color="#cfd3df"
          active-text-color="#d4af37"
        >
          <!-- 一级菜单：平项 -->
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>
          <el-menu-item index="/users">
            <el-icon><User /></el-icon>
            <template #title>用户管理</template>
          </el-menu-item>
          <el-menu-item index="/chat-records">
            <el-icon><ChatLineRound /></el-icon>
            <template #title>聊天记录</template>
          </el-menu-item>
          <el-menu-item index="/orders">
            <el-icon><List /></el-icon>
            <template #title>订单管理</template>
          </el-menu-item>
          <el-menu-item index="/invite">
            <el-icon><Share /></el-icon>
            <template #title>邀请管理</template>
          </el-menu-item>
          <el-menu-item index="/gifts">
            <el-icon><Present /></el-icon>
            <template #title>礼物管理</template>
          </el-menu-item>

          <!-- 内容管理（子菜单：反馈管理 / 评论管理 / 评价管理） -->
          <el-sub-menu index="content">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>内容管理</span>
            </template>
            <el-menu-item index="/content">
              <el-icon><ChatLineSquare /></el-icon>
              <span>反馈管理</span>
            </el-menu-item>
            <el-menu-item index="/content/comments">
              <el-icon><ChatDotSquare /></el-icon>
              <span>评论管理</span>
            </el-menu-item>
            <el-menu-item index="/content/reviews">
              <el-icon><Star /></el-icon>
              <span>评价管理</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 发现管理（子菜单：动态管理 / 组局管理） -->
          <el-sub-menu index="discover">
            <template #title>
              <el-icon><Compass /></el-icon>
              <span>发现管理</span>
            </template>
            <el-menu-item index="/discover/posts">
              <el-icon><ChatDotRound /></el-icon>
              <span>动态管理</span>
            </el-menu-item>
            <el-menu-item index="/discover/groups">
              <el-icon><UserFilled /></el-icon>
              <span>组局管理</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 社交管理 -->
          <el-sub-menu index="social">
            <template #title>
              <el-icon><Connection /></el-icon>
              <span>社交管理</span>
            </template>
            <el-menu-item index="/social/follows">
              <el-icon><Connection /></el-icon>
              <span>关注关系</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 运营管理（子菜单：Banner / 公告 / 签到 / 任务） -->
          <el-sub-menu index="operations">
            <template #title>
              <el-icon><Promotion /></el-icon>
              <span>运营管理</span>
            </template>
            <el-menu-item index="/operations/banners">
              <el-icon><PictureFilled /></el-icon>
              <span>Banner 管理</span>
            </el-menu-item>
            <el-menu-item index="/operations/announcements">
              <el-icon><Bell /></el-icon>
              <span>系统公告</span>
            </el-menu-item>
            <el-menu-item index="/operations/sign-ins">
              <el-icon><Calendar /></el-icon>
              <span>签到记录</span>
            </el-menu-item>
            <el-menu-item index="/operations/task-records">
              <el-icon><Finished /></el-icon>
              <span>任务记录</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 财务管理（子菜单：提现审核 / 精英订单） -->
          <el-sub-menu index="finance">
            <template #title>
              <el-icon><Wallet /></el-icon>
              <span>财务管理</span>
            </template>
            <el-menu-item index="/finance">
              <el-icon><Tickets /></el-icon>
              <span>提现审核</span>
            </el-menu-item>
            <el-menu-item index="/finance/elite-orders">
              <el-icon><Medal /></el-icon>
              <span>精英订单</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 服务管理（子菜单：服务审核 / 分类管理） -->
          <el-sub-menu index="services-group">
            <template #title>
              <el-icon><Goods /></el-icon>
              <span>服务管理</span>
            </template>
            <el-menu-item index="/services">
              <el-icon><List /></el-icon>
              <span>服务审核</span>
            </el-menu-item>
            <el-menu-item index="/services/categories">
              <el-icon><Menu /></el-icon>
              <span>分类管理</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 认证管理（子菜单：实名认证） -->
          <el-sub-menu index="auth">
            <template #title>
              <el-icon><Key /></el-icon>
              <span>认证管理</span>
            </template>
            <el-menu-item index="/auth/certifications">
              <el-icon><Avatar /></el-icon>
              <span>实名认证</span>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>配置中心</template>
          </el-menu-item>
        </el-menu>
      </div>
    </el-aside>

    <el-container>
      <!-- 顶部 -->
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <el-dropdown>
            <span class="admin-info">
              <el-avatar :size="32" class="admin-avatar">A</el-avatar>
              <span class="admin-name">管理员</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="onLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Fold, Expand,
  Wallet, Tickets, Medal,
  Goods, List, Menu,
  Compass, ChatDotRound, UserFilled,
  Promotion, PictureFilled,
  Key, Avatar, Present, Bell,
  Odometer, User, ChatLineRound, Share,
  Document, ChatLineSquare, ChatDotSquare, Star,
  Connection, Calendar, Finished, Setting
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const isCollapse = ref(false)

// 默认展开的分组（路由命中时自动展开对应 submenu key）
const groupByRoute = {
  '/finance': 'finance',
  '/finance/elite-orders': 'finance',
  '/services': 'services-group',
  '/services/categories': 'services-group',
  '/discover/posts': 'discover',
  '/discover/groups': 'discover',
  '/operations/banners': 'operations',
  '/operations/announcements': 'operations',
  '/operations/sign-ins': 'operations',
  '/operations/task-records': 'operations',
  '/content': 'content',
  '/content/comments': 'content',
  '/content/reviews': 'content',
  '/social/follows': 'social',
  '/auth/certifications': 'auth'
}
const defaultOpeneds = ref([])
function syncOpened() {
  const key = groupByRoute[route.path]
  if (key && !defaultOpeneds.value.includes(key)) defaultOpeneds.value.push(key)
}
syncOpened()
watch(() => route.path, () => nextTick(syncOpened), { immediate: true })

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '管理后台')

const onLogout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_info')
  router.push('/login')
}
</script>

<style lang="scss" scoped>
.layout { height: 100vh; }
.sidebar {
  background: linear-gradient(180deg, #0e1020 0%, #151a33 100%);
  transition: width 0.3s;
  overflow: hidden;
  border-right: 1px solid rgba(212,175,55,0.12);
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.logo {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.menu-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(212,175,55,0.25) transparent;
}
.menu-scroll::-webkit-scrollbar { width: 6px; }
.menu-scroll::-webkit-scrollbar-track { background: transparent; }
.menu-scroll::-webkit-scrollbar-thumb {
  background: rgba(212,175,55,0.25);
  border-radius: 3px;
}
.menu-scroll::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.45); }
.logo-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #d4af37 0%, #f5d583 100%);
  color: #0e1020;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20px;
  box-shadow: 0 8px 22px rgba(212,175,55,0.35);
}
.logo-text {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  background: linear-gradient(90deg, #f5d583 0%, #d4af37 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 2px;
}
:deep(.el-menu) { border-right: none; background: transparent; }
:deep(.el-sub-menu__title:hover),
:deep(.el-menu-item:hover) {
  background: rgba(212,175,55,0.08) !important;
}
:deep(.el-menu-item.is-active) {
  background: rgba(212,175,55,0.15) !important;
  color: #d4af37 !important;
}
:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 48px;
  line-height: 48px;
  border-radius: 10px;
  margin: 4px 10px;
  color: #cfd3df;
}
:deep(.el-sub-menu .el-menu-item) { margin-left: 0; padding-left: 52px !important; }

.header {
  background: linear-gradient(180deg, #1A2238 0%, #141A2D 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--by-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.collapse-btn { font-size: 20px; cursor: pointer; color: var(--by-text-1); }
.page-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--by-text-1);
}
.header-right { display: flex; align-items: center; }
.admin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 999px;
  transition: background 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.06); }
}
.admin-avatar {
  background: linear-gradient(135deg, #d4af37 0%, #7b61ff 100%) !important;
  color: #fff !important;
  font-weight: 700;
}
.admin-name { font-size: 14px; color: var(--by-text-1); font-weight: 600; }
.main {
  background: transparent;
  padding: 24px;
  overflow-y: auto;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
