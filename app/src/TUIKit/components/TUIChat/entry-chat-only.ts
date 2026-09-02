import { TUILogin } from '@tencentcloud/tui-core-lite';
import TUIChatEngine, {
  TUIConversationService,
} from '@tencentcloud/chat-uikit-engine-lite';
// 直接引 server（TUIChatKit 类）而非 ../../index.ts 桶导出：桶会连带加载所有
// TUI 组件，与本页组件形成循环依赖。H5 下本模块随聊天页懒加载，
// TUILogin 的 USER_LOGIN_SUCCESS 事件早已触发过，靠事件驱动的
// TUIChatEngine.login 不会执行，必须手动实例化并补调，否则页面空白。
import TUIChatKitServer from '../../server';
// 白夜业务层：确保 TUILogin 已登录（userSig 由业务服务端签发），以及标记服务端会话已读
import { ensureTUILogin } from '../../../utils/tuilogin';
import request from '../../../utils/request';

const TUIChatKit = new TUIChatKitServer();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 官方入口：页面 onLoad 时根据 url 参数 conversationID 打开会话。
 * 白夜改造点：
 * 1. TUILogin 未完成时先等待（最长 10s），避免 isReady()=false 导致 switchConversation
 *    永不执行、页面渲染空白（历史上"联系TA 黑屏"的根因）。
 * 2. 兼容业务侧 ?to=<userId> / ?userId=<id> 参数，自动拼成 C2C 会话。
 * 3. 进入会话时请求业务服务端历史接口，把该会话在服务端标记已读（"消息"Tab 未读数依赖它）。
 * 4. H5 懒加载补偿：手动执行 TUIChatKit.init/login 初始化 TUIChatEngine，
 *    否则 TUIStore 未建立、switchConversation 不生效、页面空白。
 */
export const initChat = async (options: Record<string, string>) => {
  let conversationID = String((options && options.conversationID) || '');
  if (!conversationID) {
    const uid = String((options && (options.to || options.userId || options.id || options.uid)) || '');
    if (uid) conversationID = `C2C${uid}`;
  }
  // verify conversationID
  if (!conversationID || (!conversationID.startsWith('C2C') && !conversationID.startsWith('GROUP'))) {
    console.warn('[TUIChat] conversationID from options is invalid.');
    return;
  }

  // 等待 SDK 就绪：先尝试业务登录（幂等），再轮询 isReady 最长 10s
  const isReady = () => {
    try {
      const ctx: any = TUILogin.getContext();
      return !!(ctx && ctx.chat && typeof ctx.chat.isReady === 'function' && ctx.chat.isReady());
    } catch (_) {
      return false;
    }
  };
  if (!isReady()) {
    try { await ensureTUILogin(); } catch (_) { /* 继续轮询兜底 */ }
    for (let i = 0; i < 40 && !isReady(); i++) {
      await wait(250);
    }
  }
  if (!isReady()) {
    console.warn('[TUIChat] IM SDK 等待就绪超时，会话可能无法正常渲染');
    return;
  }

  // 初始化 TUIKit：官方组件依赖 TUIChatEngine.login 完成 TUIStore/服务初始化。
  // H5 下本模块懒加载晚于登录事件，事件驱动链路失效，这里必须手动补调。
  try {
    TUIChatKit.init();
    const ctx: any = TUILogin.getContext();
    const eng: any = TUIChatEngine;
    if (ctx && ctx.chat && (!eng.isInited || eng.userID !== ctx.userID)) {
      TUIChatKit.login();
    }
  } catch (e: any) {
    console.warn('[TUIChat] TUIChatKit init/login error:', e && e.message);
  }

  // open chat
  TUIConversationService.switchConversation(conversationID);

  // 业务服务端标记已读（不影响 TIM 渲染，静默失败）
  if (conversationID.startsWith('C2C')) {
    const peerId = conversationID.replace(/^C2C/, '');
    request({ url: `/chat/history/${peerId}?page=1&pageSize=1`, method: 'GET' }).catch(() => {});

    // 自动打招呼：无历史消息时经 TIM 发一句问候
    if (String(options && options.hi) === '1') {
      (async () => {
        try {
          const hr: any = await request({ url: `/chat/history/${peerId}?page=1&pageSize=1`, method: 'GET' });
          const total = (hr && hr.data && hr.data.total) || 0;
          if (total) return;
          const ctx: any = TUILogin.getContext();
          const chat = ctx && ctx.chat;
          if (!chat || typeof chat.createTextMessage !== 'function') return;
          const msg = chat.createTextMessage({
            to: peerId,
            conversationType: 'C2C',
            payload: { text: '你好，我对你的服务很感兴趣，方便聊聊吗？' },
          });
          await chat.sendMessage(msg);
        } catch (_) { /* 打招呼失败不影响聊天 */ }
      })();
    }
  }
};

export const logout = (flag: boolean) => {
  if (flag) {
    return TUILogin.logout();
  }
  return Promise.resolve();
};
