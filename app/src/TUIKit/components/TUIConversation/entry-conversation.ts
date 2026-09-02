import { TUILogin } from '@tencentcloud/tui-core-lite';
import TUIChatEngine, {
  TUIConversationService,
} from '@tencentcloud/chat-uikit-engine-lite';
// 直接引顶层 server（TUIChatKit 类）做 engine 初始化，避免引桶造成循环依赖，
// 与 TUIChat 的 entry-chat-only.ts 保持同一套就绪/补调范式。
import TUIChatKitServer from '../../server';
import TUIConversationServer from './server';
import { ensureTUILogin } from '../../../utils/tuilogin';

const TUIChatKit = new TUIChatKitServer();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isReady = () => {
  try {
    const ctx: any = TUILogin.getContext();
    return !!(ctx && ctx.chat && typeof ctx.chat.isReady === 'function' && ctx.chat.isReady());
  } catch (_) {
    return false;
  }
};

let _started = false;

/**
 * 官方会话列表页初始化（H5 / APP 懒加载补偿）：
 * 1. 注册 TUIConversationServer（发起单聊/群聊等 service），getInstance 幂等。
 * 2. 等待 TUILogin 就绪（最长 10s），否则 TUIStore 未建立、列表空白。
 * 3. 手动补调 TUIChatKit.init/login 建立 TUIChatEngine，SDK 登录后自动同步 conversationList/totalUnreadCount。
 * @returns 是否初始化成功（失败时页面展示占位，不白屏）
 */
export const initConversation = async (): Promise<boolean> => {
  try {
    TUIConversationServer.getInstance();
  } catch (_) { /* ignore */ }

  if (!isReady()) {
    try { await ensureTUILogin(); } catch (_) { /* 继续轮询兜底 */ }
    for (let i = 0; i < 40 && !isReady(); i++) {
      await wait(250);
    }
  }
  if (!isReady()) {
    console.warn('[TUIConversation] IM SDK 等待就绪超时，会话列表可能为空');
    return false;
  }

  try {
    TUIChatKit.init();
    const ctx: any = TUILogin.getContext();
    const eng: any = TUIChatEngine;
    if (ctx && ctx.chat && (!eng.isInited || eng.userID !== ctx.userID)) {
      TUIChatKit.login();
    }
  } catch (e: any) {
    console.warn('[TUIConversation] TUIChatKit init/login error:', e && e.message);
  }

  if (!_started) {
    _started = true;
    try {
      const svc: any = TUIConversationService;
      if (svc && typeof svc.getConversationList === 'function') {
        svc.getConversationList().catch(() => { /* ignore */ });
      }
    } catch (_) { /* ignore */ }
  }
  return true;
};
