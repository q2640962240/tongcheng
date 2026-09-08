const { Transaction } = require("./src/models");

/**
 * 为历史交易记录回填 orderId（之前创建的交易没有订单号）
 * 规则：
 *  - gift_send   -> GF{id}
 *  - gift_income -> GI{id}
 *  - reward      -> RW{id}
 *  - recharge    -> RC{id}
 *  - withdraw    -> WD{id}
 *  - consume     -> CS{id}
 *  - 其他        -> TX{id}
 */
(async () => {
  const prefixMap = {
    gift_send: 'GF', gift_income: 'GI', reward: 'RW',
    recharge: 'RC', withdraw: 'WD', consume: 'CS',
    exchange: 'EX', income: 'IN', refund: 'RF',
    elite_pay: 'EP', diamond_unlock_wechat: 'DU',
    admin_adjustment: 'AD', gift_withdraw: 'GW'
  }
  const rows = await Transaction.findAll({
    attributes: ['id', 'type', 'orderId'],
    where: { orderId: null }
  })
  console.log(`Found ${rows.length} transactions without orderId`)
  let updated = 0
  for (const r of rows) {
    const prefix = prefixMap[r.type] || 'TX'
    const orderId = `${prefix}${r.id}`
    await r.update({ orderId })
    updated++
  }
  console.log(`Updated ${updated} transactions with orderId`)
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
