<template>
  <div
    ref="conversationListInnerDomRef"
    class="tui-conversation-list"
  >
    <ActionsMenu
      v-if="isShowOverlay"
      :selectedConversation="currentConversation"
      :actionsMenuPosition="actionsMenuPosition"
      :selectedConversationDomRect="currentConversationDomRect"
      @closeConversationActionMenu="closeConversationActionMenu"
    />
    <div
      v-for="(conversation, index) in conversationList"
      :id="`convlistitem-${index}`"
      :key="index"
      :class="[
        'tui-conversation-content',
        isMobile && 'tui-conversation-content-h5 disable-select',
      ]"
    >
      <div
        :class="[
          isPC && 'isPC',
          'tui-conversation-item',
          currentConversationID === conversation.conversationID &&
            'tui-conversation-item-selected',
          conversation.isPinned && 'tui-conversation-item-pinned',
        ]"
        @click="enterConversationChat(conversation.conversationID)"
        @longpress="showConversationActionMenu($event, conversation, index)"
        @contextmenu="showConversationActionMenu($event, conversation, index, true)"
      >
        <aside class="left">
          <Avatar
            useSkeletonAnimation
            :url="conversation.getAvatar()"
            size="40px"
          />
          <div
            v-if="userOnlineStatusMap && isShowUserOnlineStatus(conversation)"
            :class="[
              'online-status',
              Object.keys(userOnlineStatusMap).length > 0 &&
                Object.keys(userOnlineStatusMap).includes(
                  conversation.userProfile.userID
                ) &&
                userOnlineStatusMap[conversation.userProfile.userID]
                  .statusType === 1
                ? 'online-status-online'
                : 'online-status-offline',
            ]"
          />
          <span
            v-if="conversation.unreadCount > 0 && !conversation.isMuted"
            class="num"
          >
            {{
              conversation.unreadCount > 99 ? "99+" : conversation.unreadCount
            }}
          </span>
          <span
            v-if="conversation.unreadCount > 0 && conversation.isMuted"
            class="num-notify"
          />
        </aside>
        <div class="content">
          <div class="content-header">
            <label class="content-header-label">
              <p class="name">{{ conversation.getShowName() }}</p>
            </label>
            <div class="middle-box">
              <span
                v-if="conversation.draftText && conversation.conversationID !== currentConversationID"
                class="middle-box-draft"
              >{{ TUITranslateService.t('TUIChat.[草稿]') }}</span>
              <span
                v-else-if="
                  conversation.type === 'GROUP' &&
                    conversation.groupAtInfoList &&
                    conversation.groupAtInfoList.length > 0
                "
                class="middle-box-at"
              >{{ conversation.getGroupAtInfo() }}</span>
              <div class="middle-box-content">
                {{ lastMessageSummary(conversation) }}
              </div>
            </div>
          </div>
          <div class="content-footer">
            <span class="time">{{ conversation.getLastMessage("time") }}</span>
            <Icon
              v-if="conversation.isMuted"
              :file="muteIcon"
              size="16px"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
interface IUserStatus {
  statusType: number;
  customStatus: string;
}

interface IUserStatusMap {
  [userID: string]: IUserStatus;
}

import { ref, onMounted, onUnmounted } from '../../../adapter-vue';
import TUIChatEngine, {
  TUIStore,
  StoreName,
  TUIConversationService,
  TUITranslateService,
  IConversationModel,
} from '@tencentcloud/chat-uikit-engine-lite';
import { TUIGlobal, isIOS, addLongPressListener } from '@tencentcloud/universal-api';
import { TUILogin } from '@tencentcloud/tui-core-lite';
import Icon from '../../common/Icon.vue';
import Avatar from '../../common/Avatar/index.vue';
import ActionsMenu from '../actions-menu/index.vue';
import muteIcon from '../../../assets/icon/mute.svg';
import { isPC, isH5, isUniFrameWork, isMobile } from '../../../utils/env';
import { CHAT_MSG_CUSTOM_TYPE } from '../../../constant';

const emits = defineEmits(['handleSwitchConversation', 'getPassingRef']);
const currentConversation = ref<IConversationModel>();
const currentConversationID = ref<string>();
const currentConversationDomRect = ref<DOMRect>();
const isShowOverlay = ref<boolean>(false);
const conversationList = ref<IConversationModel[]>([]);
const conversationListDomRef = ref<HTMLElement | undefined>();
const conversationListInnerDomRef = ref<HTMLElement | undefined>();
const actionsMenuPosition = ref<{
  top: number;
  left: number | undefined;
  conversationHeight: number | undefined;
}>({
  top: 0,
  left: undefined,
  conversationHeight: undefined,
});
const displayOnlineStatus = ref(false);
const userOnlineStatusMap = ref<IUserStatusMap>();

let lastestOpenActionsMenuTime: number | null = null;

onMounted(() => {
  TUIStore.watch(StoreName.CONV, {
    currentConversationID: onCurrentConversationIDUpdated,
    conversationList: onConversationListUpdated,
    currentConversation: onCurrentConversationUpdated,
  });

  TUIStore.watch(StoreName.USER, {
    displayOnlineStatus: onDisplayOnlineStatusUpdated,
    userStatusList: onUserStatusListUpdated,
  });

  if (!isUniFrameWork && isIOS && !isPC) {
    addLongPressHandler();
  }
});

onUnmounted(() => {
  TUIStore.unwatch(StoreName.CONV, {
    currentConversationID: onCurrentConversationIDUpdated,
    conversationList: onConversationListUpdated,
    currentConversation: onCurrentConversationUpdated,
  });

  TUIStore.unwatch(StoreName.USER, {
    displayOnlineStatus: onDisplayOnlineStatusUpdated,
    userStatusList: onUserStatusListUpdated,
  });
});

const isShowUserOnlineStatus = (conversation: IConversationModel): boolean => {
  return (
    displayOnlineStatus.value
    && conversation.type === TUIChatEngine.TYPES.CONV_C2C
  );
};

// Lite SDK 的 getLastMessageText() 对自定义消息只取 messageForShow（恒为「[自定义消息]」），
// 并不解析 payload.data，所以服务端在 Desc 里传的「送出了N个XX」根本用不上。
// 这里只接管礼物消息的摘要，其余一律交回 SDK，避免复刻它的草稿/撤回/群提示分支。
const lastMessageSummary = (conversation: IConversationModel): string => {
  const fallback = conversation.getLastMessage('text') || '';
  if (conversation.draftText) return fallback;
  const last = conversation.lastMessage;
  if (!last || last.isRevoked || last.type !== TUIChatEngine.TYPES.MSG_CUSTOM) return fallback;
  let data: any;
  try {
    data = typeof last.payload?.data === 'string' ? JSON.parse(last.payload.data) : last.payload?.data;
  } catch (e) {
    return fallback;
  }
  // 判定必须与 message-custom.vue 的 isGiftMessage 一致，否则同一批早期礼物消息
  // （服务端补 businessID 之前由兜底通道转发进 IM 的那些）在聊天里是礼物卡、
  // 在会话列表里却仍是「[自定义消息]」。IM 云端已投递的消息改不了，只能读侧放宽。
  const isGift = data && typeof data === 'object'
    && (data.businessID === CHAT_MSG_CUSTOM_TYPE.GIFT || (!data.businessID && !!data.giftName));
  if (!isGift) return fallback;
  const qty = Number(data.quantity) > 0 ? Number(data.quantity) : 1;
  const name = data.giftName || '礼物';
  const text = qty > 1 ? `[礼物] 送出了${qty}个${name}` : `[礼物] ${name}`;
  // SDK 会在摘要前拼未读条数前缀（如「[3条]」），接管正文时要原样带回来，
  // 否则有未读礼物时前缀会消失。直接复用 SDK 已算好的前缀，不自己复刻它的判定条件。
  const unread = /^\[\d+\+?条\]/.exec(fallback);
  return unread ? unread[0] + text : text;
};

const showConversationActionMenu = (
  event: Event,
  conversation: IConversationModel,
  index: number,
  isContextMenuEvent?: boolean,
) => {
  if (isContextMenuEvent) {
    event.preventDefault();
    if (isUniFrameWork) {
      return;
    }
  }
  currentConversation.value = conversation;
  lastestOpenActionsMenuTime = Date.now();
  getActionsMenuPosition(event, index);
};

const closeConversationActionMenu = () => {
  // Prevent continuous triggering of overlay tap events
  if (
    lastestOpenActionsMenuTime
    && Date.now() - lastestOpenActionsMenuTime > 300
  ) {
    currentConversation.value = undefined;
    isShowOverlay.value = false;
  }
};

const getActionsMenuPosition = (event: Event, index: number) => {
  if (isUniFrameWork) {
    if (typeof conversationListDomRef.value === 'undefined') {
      emits('getPassingRef', conversationListDomRef);
    }
    const query = TUIGlobal?.createSelectorQuery().in(conversationListDomRef.value);
    query.select(`#convlistitem-${index}`).boundingClientRect((data) => {
      if (data) {
        actionsMenuPosition.value = {
          // The uni-page-head of uni-h5 is not considered a member of the viewport, so the height of the head is manually increased.
          top: data.bottom - 44,
          // @ts-expect-error in uniapp event has touches property
          left: event.touches[0].pageX,
          conversationHeight: data.height,
        };
        isShowOverlay.value = true;
      }
    }).exec();
  } else {
    const rect = ((event.currentTarget || event.target) as HTMLElement)?.getBoundingClientRect() || {};
    if (rect) {
      actionsMenuPosition.value = {
        top: rect.bottom,
        left: isPC ? (event as MouseEvent).clientX : undefined,
        conversationHeight: rect.height,
      };
    }
    isShowOverlay.value = true;
  }
};

const enterConversationChat = (conversationID: string) => {
  emits('handleSwitchConversation', conversationID);
  TUIConversationService.switchConversation(conversationID);
  // 进入会话即清该会话未读：确保返回列表后红点/角标回落（不完全依赖 SDK 自动时机）
  try {
    const chat = (TUILogin.getContext() as any)?.chat;
    if (chat && typeof chat.setMessageRead === 'function') {
      chat.setMessageRead({ conversationID }).catch(() => { /* ignore */ });
    }
  } catch (_) { /* ignore */ }
};

function addLongPressHandler() {
  if (!conversationListInnerDomRef.value) {
    return;
  }
  addLongPressListener({
    element: conversationListInnerDomRef.value,
    onLongPress: (event, target) => {
      const index = (Array.from(conversationListInnerDomRef.value!.children) as HTMLElement[]).indexOf(target!);
      showConversationActionMenu(event, conversationList.value[index], index);
    },
    options: {
      eventDelegation: {
        subSelector: '.tui-conversation-content',
      },
    },
  });
}

function onCurrentConversationUpdated(conversation: IConversationModel) {
  currentConversation.value = conversation;
}

function onConversationListUpdated(list: IConversationModel[]) {
  conversationList.value = list;
}

function onCurrentConversationIDUpdated(id: string) {
  currentConversationID.value = id;
}

function onDisplayOnlineStatusUpdated(status: boolean) {
  displayOnlineStatus.value = status;
}

function onUserStatusListUpdated(list: Map<string, IUserStatus>) {
  if (list.size !== 0) {
    userOnlineStatusMap.value = [...list.entries()].reduce(
      (obj, [key, value]) => {
        obj[key] = value;
        return obj;
      },
      {} as IUserStatusMap,
    );
  }
}
// Expose to the parent component and close actionsMenu when a sliding event is detected
defineExpose({ closeChildren: closeConversationActionMenu });
</script>

<style lang="scss" scoped src="./style/index.scss"></style>
<style lang="scss" scoped>
.disable-select {
  -webkit-touch-callout:none;
  -webkit-user-select:none;
  -khtml-user-select:none;
  -moz-user-select:none;
  -ms-user-select:none;
  user-select:none;
}
</style>
