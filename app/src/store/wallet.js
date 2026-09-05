/** 钱包状态 */
import { defineStore } from 'pinia'
import { get, post } from '../utils/request'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    diamond: 0,      // 钻石（充值币）
    starCoin: 0,     // 星币（消费币）
    income: 0,       // 可提现收入（分）
    giftIncome: 0,   // 礼物收入（分）
    withdrawable: 0  // 可提现金额
  }),
  actions: {
    /** 获取余额 */
    async fetchBalance() {
      const res = await get('/wallet/balance')
      this.diamond = res.data.diamond
      this.starCoin = res.data.starCoin
      this.income = res.data.income
      this.giftIncome = res.data.giftIncome ?? 0
      this.withdrawable = res.data.withdrawable
      return res.data
    },

    /** 充值钻石 */
    async recharge(amount) {
      const res = await post('/wallet/recharge', { amount })
      return res.data
    },

    /** 钻石兑换星币 */
    async exchange(count) {
      const res = await post('/wallet/exchange', { count })
      return res.data
    },

    /** 提现 */
    async withdraw(amount) {
      const res = await post('/wallet/withdraw', { amount })
      return res.data
    }
  }
})
