/**
 * 模型装配器（兼容 MySQL / JSON 两种驱动）
 * ------------------------------------------------
 *  - 生产环境 NODE_ENV=production → 默认强制走 MySQL
 *  - 开发/测试可通过 DB_DRIVER=mysql/json 显式切换
 *  - 所有 Model 统一从本文件导出，routes 不再直接依赖 store
 *  - 提供 bootstrap()：建表 + 校验连接，供 app.js / seed.js 调用
 */
const sequelize = require('../config/database')
const { Op, fn, col, literal, DataTypes } = require(
  sequelize.usingMysql ? 'sequelize' : '../store'
)

// 1. 载入所有模型（顺序不影响 Sequelize 关联声明，但建议先独立表再关系表）
const Admin = require('./Admin')
const User = require('./User')
const Wallet = require('./Wallet')
const Service = require('./Service')
const ServiceCategory = require('./ServiceCategory')
const Order = require('./Order')
const Transaction = require('./Transaction')
const Review = require('./Review')
const Invite = require('./Invite')
const Message = require('./Message')
const Config = require('./Config')
const Feedback = require('./Feedback')
const Banner = require('./Banner')
const Post = require('./Post')
const Comment = require('./Comment')
const Group = require('./Group')
const GroupJoin = require('./GroupJoin')
const EliteOrder = require('./EliteOrder')
const SignIn = require('./SignIn')
const Follow = require('./Follow')
const Greeting = require('./Greeting')
const Gift = require('./Gift')
const GiftRecord = require('./GiftRecord')

// 2. 声明关联关系（仅当 Sequelize 原生支持时生效；JSON 层在 routes 里 in-memory join）
if (sequelize.usingMysql) {
  // User <-> Wallet 1:1
  User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet', onDelete: 'CASCADE' })
  Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' })

  // User <-> Invite 1:N (inviter)
  User.hasMany(Invite, { foreignKey: 'inviterId', as: 'inviteRecords' })
  Invite.belongsTo(User, { foreignKey: 'inviterId', as: 'inviter' })
  Invite.belongsTo(User, { foreignKey: 'inviteeId', as: 'invitee' })

  // User <-> Service 1:N (provider)
  User.hasMany(Service, { foreignKey: 'providerId', as: 'services' })
  Service.belongsTo(User, { foreignKey: 'providerId', as: 'provider' })

  // User <-> Order 作为买方
  User.hasMany(Order, { foreignKey: 'userId', as: 'buyerOrders' })
  Order.belongsTo(User, { foreignKey: 'userId', as: 'buyer' })
  // User <-> Order 作为卖方
  User.hasMany(Order, { foreignKey: 'providerId', as: 'sellerOrders' })
  Order.belongsTo(User, { foreignKey: 'providerId', as: 'provider' })
  // Order <-> Service N:1
  Order.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' })
  Service.hasMany(Order, { foreignKey: 'serviceId', as: 'orders' })

  // User <-> Transaction 1:N
  User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' })
  Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' })

  // Review 关联
  Review.belongsTo(User, { foreignKey: 'userId', as: 'reviewer' })
  Review.belongsTo(User, { foreignKey: 'providerId', as: 'provider' })
  Review.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })
  Review.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' })

  // IM Message
  Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' })
  Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' })

  // Feedback
  Feedback.belongsTo(User, { foreignKey: 'userId', as: 'author' })
  Feedback.belongsTo(User, { foreignKey: 'targetUserId', as: 'targetUser' })
  Feedback.belongsTo(Post, { foreignKey: 'postId', as: 'post' })
  Feedback.belongsTo(Group, { foreignKey: 'groupId', as: 'group' })

  // Post / Comment
  Post.belongsTo(User, { foreignKey: 'userId', as: 'author' })
  Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments' })
  Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' })
  Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' })
  Comment.belongsTo(User, { foreignKey: 'replyToUserId', as: 'replyTo' })

  // Group / GroupJoin
  Group.belongsTo(User, { foreignKey: 'userId', as: 'owner' })
  Group.hasMany(GroupJoin, { foreignKey: 'groupId', as: 'joins' })
  GroupJoin.belongsTo(Group, { foreignKey: 'groupId', as: 'group' })
  GroupJoin.belongsTo(User, { foreignKey: 'userId', as: 'user' })

  // Elite / SignIn
  EliteOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  User.hasMany(EliteOrder, { foreignKey: 'userId', as: 'eliteOrders' })
  SignIn.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  User.hasMany(SignIn, { foreignKey: 'userId', as: 'signIns' })

  // Follow
  User.hasMany(Follow, { as: 'following', foreignKey: 'followerId' })
  User.hasMany(Follow, { as: 'followers', foreignKey: 'followingId' })
  Follow.belongsTo(User, { foreignKey: 'followerId', as: 'followerUser' })
  Follow.belongsTo(User, { foreignKey: 'followingId', as: 'followingUser' })

  // GiftRecord
  User.hasMany(GiftRecord, { as: 'sentGifts', foreignKey: 'senderId' })
  User.hasMany(GiftRecord, { as: 'receivedGifts', foreignKey: 'receiverId' })
  GiftRecord.belongsTo(User, { foreignKey: 'senderId', as: 'sender' })
  GiftRecord.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' })
  GiftRecord.belongsTo(Gift, { foreignKey: 'giftId', as: 'gift' })

  // Greeting
  User.hasMany(Greeting, { as: 'sentGreetings', foreignKey: 'senderId' })
  User.hasMany(Greeting, { as: 'receivedGreetings', foreignKey: 'receiverId' })
  Greeting.belongsTo(User, { foreignKey: 'senderId', as: 'sender' })
  Greeting.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' })
}

// 3. bootstrap：启动期建表 + 健康校验（幂等）
async function bootstrap(options = {}) {
  const force = !!options.force
  if (sequelize.usingMysql) {
    try {
      await sequelize.authenticate()
    } catch (err) {
      console.error('[DB] 连接 MySQL 失败，请检查 .env 的 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD：', err.message)
      throw err
    }
    // force=true 时直接重建表（初始化用）；否则用 alter 补齐新增列
    if (force) {
      await sequelize.sync({ force: true })
    } else {
      await sequelize.sync({ alter: true })
    }
    return { driver: 'mysql', force }
  } else {
    await sequelize.sync()
    return { driver: 'json', alter: false, force: false }
  }
}

const db = {
  sequelize,
  Sequelize: sequelize.usingMysql ? require('sequelize') : null,
  usingMysql: !!sequelize.usingMysql,
  bootstrap,
  Op, fn, col, literal, DataTypes,

  Admin, User, Wallet, Service, ServiceCategory, Order, Transaction,
  Review, Invite, Message, Config, Feedback, Banner,
  Post, Comment, Group, GroupJoin, EliteOrder, SignIn,
  Follow, Greeting, Gift, GiftRecord
}

module.exports = db
