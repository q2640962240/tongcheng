/**
 * 白夜后端 · PM2 生产进程守护配置（宝塔面板推荐）
 * ------------------------------------------------
 * 用法（宝塔 → 软件商店 → 安装 PM2 管理器 → 项目目录选中 server/ → 启动文件选 src/app.js，
 * 或直接在服务器命令行执行）：
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save                    # 写入开机自启
 *   pm2 startup                 # （首次）配置 systemd 开机自启脚本，按提示复制命令执行
 *   pm2 reload by-server        # 热重载（0 中断部署）
 *   pm2 logs by-server --lines 200
 *
 * 部署前必读：
 *   1) .env 必须在 server/ 目录下，且 NODE_ENV=production / DB_DRIVER=mysql
 *      （即使 DB_DRIVER 不写，只要 NODE_ENV=production 也会强制走真实 MySQL）
 *   2) 上传目录 server/uploads/ 与数据库 MySQL 必须在部署机器/内网可达
 *   3) Nginx client_max_body_size 建议 20m，与 multer 限制对齐（见 nginx-baiye.conf）
 */
module.exports = {
  apps: [{
    name: 'by-server',
    script: 'src/app.js',
    cwd: __dirname,
    args: '',
    // 实例数选择策略（2026-08 调优，避免 OOM）：
    //   · 显式 BY_INSTANCES 优先。
    //   · 2C/4C 轻量服务器「默认单实例 + 小池」安全上限；想开启 cluster 做 0 中断 reload，请显式设置。
    //   · 建议表：
    //       2C2G 同机 MySQL：BY_INSTANCES=1  BY_MAX_MEM=384M  DB_POOL_MIN=1  DB_POOL_MAX=6
    //       2C4G 同机 MySQL：BY_INSTANCES=1  BY_MAX_MEM=512M  DB_POOL_MIN=1  DB_POOL_MAX=10
    //       4C8G+ 或 DB 上云：BY_INSTANCES=3  BY_MAX_MEM=768M  DB_POOL_MIN=4  DB_POOL_MAX=30
    instances: (() => {
      if (process.env.BY_INSTANCES) return Number(process.env.BY_INSTANCES) || 1
      const cpus = (require('os').cpus() || []).length || 1
      // 2C 及以下默认 1（防 Node 双实例 + MySQL + Nginx 打爆 2G）
      if (cpus <= 2) return 1
      // 4C / 8C 默认 2 / 3（可通过 BY_INSTANCES 放大）
      return Math.min(3, Math.max(1, cpus - 1))
    })(),
    // 内存回收阈值：同机部署 MySQL 时 2C2G → 384M；DB 独立可 768M-1G
    exec_mode: (process.env.BY_INSTANCES && Number(process.env.BY_INSTANCES) > 1) ? 'cluster' : 'fork',
    max_memory_restart: process.env.BY_MAX_MEM || '768M',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 日志切分（按天，保留 14 天）
    log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    combine_logs: true,
    merge_logs: true,
    max_files: 14,
    // 0 秒退出判定为正常启动期失败：延迟 watch 避免 nodemon/push 时反复重启
    autorestart: true,
    watch: false,
    kill_timeout: 8000,
    listen_timeout: 15000,
    // 异常重启保护：1 分钟内连续 5 次崩溃就停止自动重启（避免死循环）
    min_uptime: '60s',
    max_restarts: 5,
    restart_delay: 3000
  }]
}
