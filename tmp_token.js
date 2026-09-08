const jwt = require('jsonwebtoken')
const config = require('./src/config')
console.log(jwt.sign({ id: 27 }, config.jwt.secret, { expiresIn: '3h' }))
