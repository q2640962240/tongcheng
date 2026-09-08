const { Transaction } = require("./src/models");
(async () => {
  const rows = await Transaction.findAll({
    attributes: ["id", "type", "amount", "currency", "orderId", "remark"],
    order: [["id", "DESC"]],
    limit: 15
  });
  rows.forEach(r => {
    console.log(
      String(r.id).padStart(4),
      String(r.type).padEnd(18),
      String(r.amount).padStart(8),
      String(r.currency || "").padEnd(10),
      "orderId=" + JSON.stringify(r.orderId || "NULL"),
      "remark=" + JSON.stringify((r.remark || "").slice(0, 30))
    );
  });
  process.exit(0);
})();
