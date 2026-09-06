<template>
  <div class="chat">
    <div :class="['tui-chat', !isPC && 'tui-chat-h5']">
      <div
        v-if="!currentConversationID"
        :class="['tui-chat-default', !isPC && 'tui-chat-h5-default']"
      >
        <slot />
      </div>
      <div
        v-if="currentConversationID"
        :class="['tui-chat', !isPC && 'tui-chat-h5']"
      >
        <ChatHeader
          :isGroup="isGroup"
          :headerExtensionList="headerExtensionList"
          @closeChat="closeChat"
          @openGroupManagement="handleGroup"
        />
        <Forward @toggleMultipleSelectMode="toggleMultipleSelectMode" />
        <MessageList
          ref="messageListRef"
          :class="['tui-chat-message-list', !isPC && 'tui-chat-h5-message-list']"
          :isGroup="isGroup"
          :groupID="groupID"
          :isNotInGroup="isNotInGroup"
          :isMultipleSelectMode="isMultipleSelectMode"
          @handleEditor="handleEditor"
          @closeInputToolBar="() => changeToolbarDisplayType('none')"
          @toggleMultipleSelectMode="toggleMultipleSelectMode"
        />
        <div
          v-if="isNotInGroup"
          :class="{
            'tui-chat-leave-group': true,
            'tui-chat-leave-group-mobile': isMobile,
          }"
        >
          {{ leaveGroupReasonText }}
        </div>
        <MultipleSelectPanel
          v-else-if="isMultipleSelectMode"
          @oneByOneForwardMessage="oneByOneForwardMessage"
          @mergeForwardMessage="mergeForwardMessage"
          @toggleMultipleSelectMode="toggleMultipleSelectMode"
        />
        <template v-else>
          <MessageInputToolbar
            v-if="isInputToolbarShow"
            :class="[
              'tui-chat-message-input-toolbar',
              !isPC && 'tui-chat-h5-message-input-toolbar',
              isUniFrameWork && 'tui-chat-uni-message-input-toolbar'
            ]"
            :displayType="inputToolbarDisplayType"
            @insertEmoji="insertEmoji"
            @changeToolbarDisplayType="changeToolbarDisplayType"
            @scrollToLatestMessage="scrollToLatestMessage"
          />
          <MessageInput
            ref="messageInputRef"
            :class="[
              'tui-chat-message-input',
              !isPC && 'tui-chat-h5-message-input',
              isUniFrameWork && 'tui-chat-uni-message-input',
              isWeChat && 'tui-chat-wx-message-input',
            ]"
            :enableAt="featureConfig.InputMention"
            :isMuted="false"
            :muteText="TUITranslateService.t('TUIChat.您已被管理员禁言')"
            :placeholder="TUITranslateService.t('TUIChat.请输入消息')"
            :inputToolbarDisplayType="inputToolbarDisplayType"
            @changeToolbarDisplayType="changeToolbarDisplayType"
          />
        </template>
        <GiftAnimation ref="giftAnimRef" />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from '../../adapter-vue';
import TUIChatEngine, {
  TUITranslateService,
  TUIConversationService,
  TUIStore,
  StoreName,
  IMessageModel,
  IConversationModel,
} from '@tencentcloud/chat-uikit-engine-lite';
import TUICore, { TUIConstants, ExtensionInfo } from '@tencentcloud/tui-core-lite';
import ChatHeader from './chat-header/index.vue';
import MessageList from './message-list/index.vue';
import MessageInput from './message-input/index.vue';
import GiftAnimation from '@/components/GiftAnimation.vue';
import { isGiftPlayed, markGiftPlayed } from '@/utils/giftAnimPlayed';
import MultipleSelectPanel from './mulitple-select-panel/index.vue';
import Forward from './forward/index.vue';
import MessageInputToolbar from './message-input-toolbar/index.vue';
import { isPC, isWeChat, isUniFrameWork, isMobile, isApp } from '../../utils/env';
import { ToolbarDisplayType } from '../../interface';
import TUIChatConfig from './config';

// @Start uniapp use Chat only
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { initChat, logout } from './entry-chat-only.ts';

/**
 * H5 高度链修复：
 * uni-app H5 中 uni-page-body 的高度是 auto（由内容撑开），而官方样式
 * `.chat { height: 100% }` 需要父级为确定高度才能解析，否则整页塌缩成内容高度、
 * 消息列表被压扁（视觉上即"组件扭曲"）。这里显式给整条父链设置 height:100%。
 */
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
function resetH5LayoutFix() {
  // #ifdef H5
  try {
    document.documentElement.style.height = '';
    document.body.style.height = '';
    H5_LAYOUT_SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.height = '';
        el.style.minHeight = '';
      }
    });
    const pageBody = document.querySelector('uni-page-body');
    if (pageBody) pageBody.style.background = '';
  } catch (_) { /* ignore */ }
  // #endif
}

onLoad((options) => {
  applyH5LayoutFix();
  initChat(options);
});

onUnload(() => {
  resetH5LayoutFix();
  // Whether logout is decided by yourself  when the page is unloaded. The default is false.
  logout(false).then(() => {
    // Handle success result from promise.then when you set true.
  }).catch(() => {
    // handle error
  });
});
// @End uniapp use Chat only

const emits = defineEmits(['closeChat']);

const groupID = ref(undefined);
const isGroup = ref(false);
const isNotInGroup = ref(false);
const notInGroupReason = ref<number>();
const currentConversationID = ref();
const isMultipleSelectMode = ref(false);
const inputToolbarDisplayType = ref<ToolbarDisplayType>('none');
const messageInputRef = ref();
const messageListRef = ref<InstanceType<typeof MessageList>>();
const giftAnimRef = ref<InstanceType<typeof GiftAnimation>>();
const headerExtensionList = ref<ExtensionInfo[]>([]);
const featureConfig = TUIChatConfig.getFeatureConfig();
// 键盘适配：App 端使用 onKeyboardHeightChange，仅触发滚动到底部，不再推移整个容器
// #ifdef APP-PLUS
uni.onKeyboardHeightChange((height) => {
  if (height > 0) {
    nextTick(() => {
      uni.$emit('scroll-to-bottom');
    });
  }
});
// #endif

// H5 端保留 onWindowResize 兼容
// #ifdef H5
const systemInfo = uni.getSystemInfoSync();
const screenHeight = systemInfo.screenHeight;
const windowResizeCallback = (res) => {
  const value = screenHeight - res.size.windowHeight;
  if (value > 0 && inputToolbarDisplayType.value !== 'dialog') {
    inputToolbarDisplayType.value = 'none';
  }
  uni.$emit('scroll-to-bottom');
};
uni.onWindowResize(windowResizeCallback);
// #endif

onMounted(() => {
  TUIStore.watch(StoreName.CONV, {
    currentConversation: onCurrentConversationUpdate,
  });
  TUIStore.watch(StoreName.CHAT, {
    messageList: onMessageListUpdate,
  });
  // 监听送礼方直接触发的动画事件
  uni.$on('gift-animation', onGiftAnimationDirect);
});

onUnmounted(() => {
  TUIStore.unwatch(StoreName.CONV, {
    currentConversation: onCurrentConversationUpdate,
  });
  TUIStore.unwatch(StoreName.CHAT, {
    messageList: onMessageListUpdate,
  });
  uni.$off('gift-animation', onGiftAnimationDirect);
  reset();
});

// 礼物特效「每条只播一次」：播放记录持久化在 utils/giftAnimPlayed，跨刷新、跨会话切换、
// 跨 App 重启都不会重播（内存 Set 只能扛住单次页面生命周期）。
//
// 消息分两类处理：
//   实时到达（msg.time > 基线）—— 每条都播一次；
//   历史消息（msg.time <= 基线）—— 本次会话打开只补播「最新一条」，其余直接登记为已播。
//     这样接收方离线期间收到的礼物，会在首次打开会话时看到一次，之后再开不再出现，
//     也不会在首屏一次性炸出整屏历史特效。
//
// 基线在会话打开时取自 conversation.lastMessage.lastTime —— 它正是最后一条历史消息的
// 服务端时间，晚于它的必然是新到达消息。
// 不要在 watcher 里惰性取「首次非空列表的最新 time」：空会话的首次非空列表就是那条
// 实时消息本身，基线会被设成它自己，导致它被当成历史消息吞掉、特效永不播放。
let baselineMsgTime = 0
// 本次会话打开是否已做过历史补播（每个会话至多补播一条）
let historyCatchupDone = false

function playGiftEffect(data: any) {
  giftAnimRef.value?.play({
    giftName: data.giftName,
    giftImage: data.giftImage,
    diamondAmount: data.diamondAmount,
    quantity: data.quantity || 1,
    animationLevel: data.animationLevel || 1,
    effectImage: data.effectImage || '',
    senderName: data.senderName || ''
  })
}

function onMessageListUpdate(messageList: IMessageModel[]) {
  if (!messageList?.length) return
  let catchup: { data: any; time: number } | null = null
  const historyKeys: string[] = []
  for (const msg of messageList) {
    if (msg?.type !== TUIChatEngine.TYPES.MSG_CUSTOM) continue
    // 注意：SDK 消息主键是 ID（大写），msg.id 恒为 undefined——用它做去重键会让
    // 第一条消息就把 undefined 塞进集合，此后所有礼物消息都被判为已处理而不再播放。
    const key = msg.ID ? `im:${msg.ID}` : ''
    if (!key || isGiftPlayed(key)) continue
    // 自己发出的礼物已由送礼面板的 gift-animation 事件即时播放，这里只登记不播，
    // 否则发送方会连播两次（直接事件一次 + 消息入列表一次）。
    if (msg.flow === 'out') {
      markGiftPlayed(key)
      continue
    }
    let data: any
    try {
      data = typeof msg.payload.data === 'string' ? JSON.parse(msg.payload.data) : msg.payload.data
    } catch (e) {
      continue
    }
    if (data?.businessID !== 'gift') continue
    if ((msg.time || 0) > baselineMsgTime) {
      markGiftPlayed(key)
      playGiftEffect(data)
      continue
    }
    if (historyCatchupDone) {
      // 已补播过（例如上滑分页翻出的更早历史），只登记
      markGiftPlayed(key)
      continue
    }
    historyKeys.push(key)
    if (!catchup || (msg.time || 0) > catchup.time) catchup = { data, time: msg.time || 0 }
  }
  if (historyKeys.length) {
    historyKeys.forEach(markGiftPlayed)
    historyCatchupDone = true
    if (catchup) playGiftEffect(catchup.data)
  }
}

// 送礼方直接触发动画（不依赖消息列表 watcher）
function onGiftAnimationDirect(giftData: any) {
  if (!giftData) return
  giftAnimRef.value?.play({
    giftName: giftData.giftName,
    giftImage: giftData.giftImage,
    diamondAmount: giftData.diamondAmount,
    quantity: giftData.quantity || 1,
    animationLevel: giftData.animationLevel || 1,
    effectImage: giftData.effectImage || '',
    senderName: giftData.senderName || ''
  })
}

const isInputToolbarShow = computed<boolean>(() => {
  return isUniFrameWork ? inputToolbarDisplayType.value !== 'none' : true;
});

const leaveGroupReasonText = computed<string>(() => {
  let text = '';
  switch (notInGroupReason.value) {
    case 4:
      text = TUITranslateService.t('TUIChat.您已被管理员移出群聊');
      break;
    case 5:
      text = TUITranslateService.t('TUIChat.该群聊已被解散');
      break;
    case 8:
      text = TUITranslateService.t('TUIChat.您已退出该群聊');
      break;
    default:
      text = TUITranslateService.t('TUIChat.您已退出该群聊');
      break;
  }
  return text;
});

const reset = () => {
  TUIConversationService.switchConversation('');
};

const closeChat = (conversationID: string) => {
  emits('closeChat', conversationID);
  reset();
};

const insertEmoji = (emojiObj: object) => {
  messageInputRef.value?.insertEmoji(emojiObj);
};

const handleEditor = (message: IMessageModel, type: string) => {
  if (!message || !type) return;
  switch (type) {
    case 'reference':
      // todo
      break;
    case 'reply':
      // todo
      break;
    case 'reedit':
      if (message?.payload?.text) {
        messageInputRef?.value?.reEdit(message?.payload?.text);
      }
      break;
    default:
      break;
  }
};

const handleGroup = () => {
  headerExtensionList.value[0].listener.onClicked({ groupID: groupID.value });
};

function changeToolbarDisplayType(type: ToolbarDisplayType) {
  setTimeout(() => {
    inputToolbarDisplayType.value = inputToolbarDisplayType.value === type ? 'none' : type;
    if (inputToolbarDisplayType.value !== 'none' && isUniFrameWork) {
      uni.$emit('scroll-to-bottom');
    }
  }, 100)
}

function scrollToLatestMessage() {
  messageListRef.value?.scrollToLatestMessage();
}

function toggleMultipleSelectMode(visible?: boolean) {
  isMultipleSelectMode.value = visible === undefined ? !isMultipleSelectMode.value : visible;
}

function mergeForwardMessage() {
  messageListRef.value?.mergeForwardMessage();
}

function oneByOneForwardMessage() {
  messageListRef.value?.oneByOneForwardMessage();
}

function updateUIUserNotInGroup(conversation: IConversationModel) {
  if (conversation?.operationType > 0) {
    headerExtensionList.value = [];
    isNotInGroup.value = true;
    /**
     * 4 - be removed from the group
     * 5 - group is dismissed
     * 8 - quit group
     */
    notInGroupReason.value = conversation?.operationType;
  } else {
    isNotInGroup.value = false;
    notInGroupReason.value = undefined;
  }
}

function onCurrentConversationUpdate(conversation: IConversationModel) {
  updateUIUserNotInGroup(conversation);
  // return when currentConversation is null
  if (!conversation) {
    return;
  }
  // return when currentConversationID.value is the same as conversation.conversationID.
  if (currentConversationID.value === conversation?.conversationID) {
    return;
  }

  isGroup.value = false;
  // 切换会话：以该会话最后一条历史消息的服务端时间为基线，并允许新会话补播一次历史特效。
  // 早于基线的都是历史（含上滑分页加载的更早消息），至多补播最新一条；晚于基线的才是
  // 新到达消息，逐条播放。去重记录是持久化的，这里不需要（也不能）清空。
  // lastMessage 缺失时用「打开时刻」兜底：基线若为 0，整屏历史都会被当成实时消息批量重放。
  baselineMsgTime = Number(conversation?.lastMessage?.lastTime) || Math.floor(Date.now() / 1000);
  historyCatchupDone = false;
  let conversationType = TUIChatEngine.TYPES.CONV_C2C;
  const conversationID = conversation.conversationID;
  if (conversationID.startsWith(TUIChatEngine.TYPES.CONV_GROUP)) {
    conversationType = TUIChatEngine.TYPES.CONV_GROUP;
    isGroup.value = true;
    groupID.value = conversationID.replace(TUIChatEngine.TYPES.CONV_GROUP, '');
  }

  headerExtensionList.value = [];
  isMultipleSelectMode.value = false;
  // Initialize chatType
  TUIChatConfig.setChatType(conversationType);
  // While converstaion change success, notify callkit and roomkit、or other components.
  TUICore.notifyEvent(TUIConstants.TUIChat.EVENT.CHAT_STATE_CHANGED, TUIConstants.TUIChat.EVENT_SUB_KEY.CHAT_OPENED, { groupID: groupID.value });
  // The TUICustomerServicePlugin plugin determines if the current conversation is a customer service conversation, then sets chatType and activates the conversation.
  TUICore.callService({
    serviceName: TUIConstants.TUICustomerServicePlugin.SERVICE.NAME,
    method: TUIConstants.TUICustomerServicePlugin.SERVICE.METHOD.ACTIVE_CONVERSATION,
    params: { conversationID: conversationID },
  });
  // When open chat in room, close main chat ui and reset theme.
  if (TUIChatConfig.getChatType() === TUIConstants.TUIChat.TYPE.ROOM) {
    if (TUIChatConfig.getFeatureConfig(TUIConstants.TUIChat.FEATURE.InputVoice) === true) {
      TUIChatConfig.setTheme('light');
      currentConversationID.value = '';
      return;
    }
  }
  // Get chat header extensions
  if (TUIChatConfig.getChatType() === TUIConstants.TUIChat.TYPE.GROUP) {
    headerExtensionList.value = TUICore.getExtensionList(TUIConstants.TUIChat.EXTENSION.CHAT_HEADER.EXT_ID);
  }
  TUIStore.update(StoreName.CUSTOM, 'activeConversation', conversationID);
  currentConversationID.value = conversationID;
}
</script>

<style scoped lang="scss" src="./style/index.scss"></style>
