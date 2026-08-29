/* 数据层：行政区划 + 统一数据访问出口（regions / search alias 等会从这里取） */
'use strict'
const chinaCities = require('./china_cities')

module.exports = {
  chinaCities
}
