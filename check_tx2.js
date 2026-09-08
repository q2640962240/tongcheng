const { Transaction, User } = require("./src/models");
(async () => {
  const total = await Transaction.count();
  console.log("total transactions:", total);
  // 按 userId 分组统计
  const rows = await Transaction.findAll({
    attributes: ["userId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "cnt"]],
    group: ["userId"],
    order: [[require("sequelize").col("cnt"), "DESC"]],
    limit: 5
  });
  for (const r of rows) {
    const u = await User.findByPk(r.userId, { attributes: ["id", "nickname"] });
    console.log(`userId=${r.userId} (${u && u.nickname}) count=${r.get("cnt")}`);
  }
  process.exit(0);
})();
