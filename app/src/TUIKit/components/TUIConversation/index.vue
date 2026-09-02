<template>
  <div
    class="tui-conversation"
    @click="handleClickConv"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <div v-if="!convReady" class="tui-conversation-loading">
      消息服务连接中…
    </div>
    <ConversationHeader>
      <TUISearch searchType="global" />
    </ConversationHeader>
    <ConversationNetwork />
    <ConversationList
      ref="conversationListDomRef"
      class="tui-conversation-list"
      @handleSwitchConversation="handleSwitchConversation"
      @getPassingRef="getPassingRef"
    />
  </div>
</template>
<script lang="ts" setup>
import { TUIStore, StoreName } from '@tencentcloud/chat-uikit-engine-lite';
import { TUIGlobal } from '@tencentcloud/universal-api';
import { ref } from '../../adapter-vue';
import TUISearch from '../TUISearch/index.vue';
import ConversationList from './conversation-list/index.vue';
import ConversationHeader from './conversation-header/index.vue';
import ConversationNetwork from './conversation-network/index.vue';
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
import { initConversation } from './entry-conversation';
import { refreshMsgBadge } from '../../../utils/msgNotify';
// #ifdef MP-WEIXIN
// uniapp packaged mini-programs are integrated by default, and the default initialization entry file is imported here
// TUIChatKit init needs to be encapsulated because uni vue2 will report an error when compiling H5 directly through conditional compilation
import './entry.ts';
// #endif

const emits = defineEmits(['handleSwitchConversation']);

const convReady = ref(true);

const H5_LAYOUT_SELECTORS = ['uni-app', 'uni-page', 'uni-page-wrapper', 'uni-page-body'];
function applyH5LayoutFix() {
  // #ifdef H5
  try {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    H5_LAYOUT_SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.height = '100%';
        el.style.minHeight = '0';
      }
    });
    const pageBody = document.querySelector('uni-page-body');
    if (pageBody) pageBody.style.background = '#ffffff';
  } catch (_) { /* ignore */ }
  // #endif
}

onLoad(() => {
  applyH5LayoutFix();
  initConversation().then((ok) => { convReady.value = ok; });
});

onShow(() => {
  // 从聊天页返回时刷新角标（非 tab 页时 removeTabBarBadge 不生效，这里在 tab 页重新计算）
  try { refreshMsgBadge(); } catch (_) { /* ignore */ }
});

const totalUnreadCount = ref(0);
const headerRef = ref<typeof ConversationHeader>();
const conversationListDomRef = ref<typeof ConversationList>();
const touchX = ref<number>(0);
const touchY = ref<number>(0);
const isShowConversationHeader = ref<boolean>(true);

const getTabBarConfig = () => {
  try {
    // 方法1: 从 getApp() 全局数据中获取
    const app = getApp();
    if (app?.globalData?.tabBar) {
      return app.globalData.tabBar;
    }
    
    // 方法2: 从 pages.json 配置中读取（如果可访问）
    // @ts-ignore
    if (typeof __uniConfig !== 'undefined' && __uniConfig.tabBar) {
      // @ts-ignore
      return __uniConfig.tabBar;
    }
    
    // 方法3: 尝试调用 uni.getTabBar() 检测是否存在 tabbar
    try {
      const tabBar = uni.getTabBar && uni.getTabBar();
      if (tabBar) {
        return { list: tabBar};
      }
    } catch (e) {
      return null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

const getTabBarIndex = () => {
  try {
  
    const pages = getCurrentPages();
    if (!pages || pages.length === 0) return;
    
    const currentPage = pages[pages.length - 1];
    const currentRoute = currentPage.route;
    
    const isTUIConversationPage = currentRoute && (
      currentRoute.includes('TUIKit/components/TUIConversation/index') ||
      currentRoute.includes('TUIConversation')
    );
    
    if (!isTUIConversationPage) {
      return;
    }
    
    const tabBarConfig = getTabBarConfig();
    
    if (!tabBarConfig) {
      return;
    }
    
    let tabBarIndex = -1;
    
    if (tabBarConfig.list && Array.isArray(tabBarConfig.list)) {
      tabBarIndex = tabBarConfig.list.findIndex((item: any) => {
        const pagePath = item.pagePath || '';
        return pagePath.includes('TUIConversation') || 
                pagePath.includes('TUIKit/components/TUIConversation/index');
      });
    }
    return tabBarIndex;
  } catch (error) {
    return -1;
  }
};

TUIStore.watch(StoreName.CONV, {
  totalUnreadCount: (count: number) => {
    totalUnreadCount.value = count;
    const tabBarIndex = getTabBarIndex() ?? -1;
    if (tabBarIndex >= 0) {
      if (count > 0) {
        uni.setTabBarBadge({
          index: tabBarIndex,
          text: count > 99 ? '99+' : count.toString(),
        });
      } else {
        uni.removeTabBarBadge({
          index: tabBarIndex,
        });
      }
    }
  },
});

TUIStore.watch(StoreName.CUSTOM, {
  isShowConversationHeader: (showStatus: boolean) => {
    isShowConversationHeader.value = showStatus !== false;
  },
});

const handleSwitchConversation = (conversationID: string) => {
  TUIGlobal?.navigateTo({
    url: '/TUIKit/components/TUIChat/index',
  });
  emits('handleSwitchConversation', conversationID);
};

const closeChildren = () => {
  headerRef?.value?.closeChildren();
  conversationListDomRef?.value?.closeChildren();
};

const handleClickConv = () => {
  closeChildren();
};

onHide(closeChildren);

const handleTouchStart = (e: any) => {
  touchX.value = e.changedTouches[0].clientX;
  touchY.value = e.changedTouches[0].clientY;
};

const handleTouchEnd = (e: any) => {
  const x = e.changedTouches[0].clientX;
  const y = e.changedTouches[0].clientY;
  let turn = '';
  if (x - touchX.value > 50 && Math.abs(y - touchY.value) < 50) {
    // Swipe right
    turn = 'right';
  } else if (x - touchX.value < -50 && Math.abs(y - touchY.value) < 50) {
    // Swipe left
    turn = 'left';
  }
  if (y - touchY.value > 50 && Math.abs(x - touchX.value) < 50) {
    // Swipe down
    turn = 'down';
  } else if (y - touchY.value < -50 && Math.abs(x - touchX.value) < 50) {
    // Swipe up
    turn = 'up';
  }
  // Operate according to the direction
  if (turn === 'down' || turn === 'up') {
    closeChildren();
  }
};

const getPassingRef = (ref) => {
  ref.value = conversationListDomRef.value;
};
</script>

<style lang="scss" scoped src="./style/index.scss"></style>
