<template>
  <div class="custom">
    <template v-if="customData.businessID === CHAT_MSG_CUSTOM_TYPE.SERVICE">
      <div>
        <h1>
          <label>{{ extension.title }}</label>
          <a
            v-if="extension.hyperlinks_text"
            :href="extension.hyperlinks_text.value"
            target="view_window"
          >{{ extension.hyperlinks_text.key }}</a>
        </h1>
        <ul v-if="extension.item && extension.item.length > 0">
          <li
            v-for="(item, index) in extension.item"
            :key="index"
          >
            <a
              v-if="isUrl(item.value)"
              :href="item.value"
              target="view_window"
            >{{ item.key }}</a>
            <p v-else>
              {{ item.key }}
            </p>
          </li>
        </ul>
        <article>{{ extension.description }}</article>
      </div>
    </template>
    <template v-else-if="customData.businessID === CHAT_MSG_CUSTOM_TYPE.EVALUATE">
      <div class="evaluate">
        <h1>{{ TUITranslateService.t("message.custom.对本次服务评价") }}</h1>
        <ul class="evaluate-list">
          <li
            v-for="(item, index) in Math.max(customData.score, 0)"
            :key="index"
            class="evaluate-list-item"
          >
            <Icon
              :file="star"
              class="file-icon"
            />
          </li>
        </ul>
        <article>{{ customData.comment }}</article>
      </div>
    </template>
    <template v-else-if="customData.businessID === CHAT_MSG_CUSTOM_TYPE.ORDER">
      <div
        class="order"
        @click="openLink(customData.link)"
      >
        <img
          :src="customData.imageUrl"
        >
        <main>
          <h1>{{ customData.title }}</h1>
          <p>{{ customData.description }}</p>
          <span>{{ customData.price }}</span>
        </main>
      </div>
    </template>
    <template v-else-if="customData.businessID === CHAT_MSG_CUSTOM_TYPE.LINK">
      <div class="textLink">
        <p>{{ customData.text }}</p>
        <a
          :href="customData.link"
          target="view_window"
        >{{
          TUITranslateService.t("message.custom.查看详情>>")
        }}</a>
      </div>
    </template>
    <template v-else-if="isGiftMessage">
      <view class="gift-message-card">
        <view class="gift-card-inner">
          <image class="gift-icon" :src="customData.giftImage" mode="aspectFill" />
          <view class="gift-info">
            <text class="gift-name">{{ customData.giftName }}</text>
            <text class="gift-price">💎 {{ giftPriceText }}</text>
          </view>
        </view>
      </view>
    </template>
    <template v-else>
      <span v-html="content.custom" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { watchEffect, ref, computed } from '../../../../adapter-vue';
import { TUITranslateService, IMessageModel } from '@tencentcloud/chat-uikit-engine-lite';
import { isUrl, JSONToObject } from '../../../../utils/index';
import { CHAT_MSG_CUSTOM_TYPE } from '../../../../constant';
import { ICustomMessagePayload } from '../../../../interface';
import Icon from '../../../common/Icon.vue';
import star from '../../../../assets/icon/star-light.png';
interface Props {
  messageItem: IMessageModel;
  content: any;
}

const props = withDefaults(defineProps<Props>(), {
  messageItem: undefined,
  content: undefined,
});

const custom = ref();
const message = ref<IMessageModel>();
const extension = ref();
const customData = ref<ICustomMessagePayload>({
  businessID: '',
});

watchEffect(() => {
  custom.value = props.content;
  message.value = props.messageItem;
  const { payload } = props.messageItem;
  customData.value = payload.data || '';
  customData.value = JSONToObject(payload.data);
  if (payload.data === CHAT_MSG_CUSTOM_TYPE.SERVICE) {
    extension.value = JSONToObject(payload.extension);
  }
});

// 生产上存在一批早期礼物消息：那时服务端 gifts.js 的 giftContent 还没写 businessID，
// 兜底通道（viaIM:false）把这份内容原样转发进了 IM，于是它们在聊天里恒渲染成
// 「[自定义消息]」。IM 云端已投递的消息改不了，只能在读侧放宽：没有 businessID 但带
// giftName 的载荷同样按礼物处理。其余自定义消息类型都自带 businessID，不受影响。
const isGiftMessage = computed(() => {
  const data = customData.value as any;
  if (!data || typeof data !== 'object') return false;
  return data.businessID === CHAT_MSG_CUSTOM_TYPE.GIFT
    || (!data.businessID && !!data.giftName);
});

// 礼物卡片显示**实付总价**。diamondAmount 在服务端消息体里是单价，直接渲染会让
// 「送 2 个水晶球（实付 4000）」显示成「💎2000」。IM 云端的历史自定义消息既没有
// totalDiamond 也没有 quantity，但那条通道数量恒为 1，兜底算出来仍等于实付总价。
const giftPriceText = computed(() => {
  const data = customData.value as any;
  const qty = Number(data?.quantity) > 0 ? Number(data.quantity) : 1;
  const unit = Number(data?.diamondAmount) || 0;
  const total = Number(data?.totalDiamond) > 0 ? Number(data.totalDiamond) : unit * qty;
  if (!total) return '';
  return qty > 1 ? `${total} ×${qty}` : `${total}`;
});

const openLink = (url: any) => {
  window.open(url);
};
</script>
<style lang="scss" scoped>
@import "../../../../assets/styles/common";

a {
  color: #679ce1;
}

.custom {
  font-size: 14px;

  h1 {
    font-size: 14px;
    color: #000;
  }

  h1,
  a,
  p {
    font-size: 14px;
  }

  .evaluate {
    ul {
      display: flex;
      padding: 10px 0;
    }

    &-list {
      display: flex;
      flex-direction: row;

      &-item {
        padding: 0 2px;
      }
    }
  }

  .order {
    display: flex;

    main {
      padding-left: 5px;

      p {
        font-family: PingFangSC-Regular;
        width: 145px;
        line-height: 17px;
        font-size: 14px;
        color: #999;
        letter-spacing: 0;
        margin-bottom: 6px;
        word-break: break-word;
      }

      span {
        font-family: PingFangSC-Regular;
        line-height: 25px;
        color: #ff7201;
      }
    }

    img {
      width: 67px;
      height: 67px;
    }
  }
}

.gift-message-card {
  display: flex;
  padding: 4px 0;
}

.gift-card-inner {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #1A2238 0%, #2A1F3D 100%);
  border-radius: 12px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 215, 0, 0.25);
  box-shadow: 0 2px 12px rgba(255, 215, 0, 0.08);
  /* 190 = 160 内容 + 14×2 padding + 1×2 border。全局 border-box 重置后
   * min-width 量的是边框盒，写 160 会让卡片窄掉 30px 并把气泡一起带窄。 */
  min-width: 190px;
}

.gift-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.1);
  flex-shrink: 0;
}

.gift-info {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
}

.gift-name {
  font-size: 14px;
  font-weight: 600;
  color: #F5F7FF;
  line-height: 1.3;
}

.gift-price {
  font-size: 12px;
  color: #FFD700;
  margin-top: 3px;
  font-weight: 500;
}
</style>
