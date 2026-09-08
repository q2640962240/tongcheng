const jwt = require('jsonwebtoken')
const config = require('./src/config')
const token = jwt.sign({ id: 27 }, config.jwt.secret, { expiresIn: '1h' })
console.log(token)
