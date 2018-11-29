#!/usr/bin/env node

import EnvSetup from './EnvSetup'
import path = require('path')

console.log('[ENV SETUP] init')

if (process.argv.length > 1) {
  if (process.argv[2] === '--config') {
    const configPath = process.argv[3]
    if (configPath) {
      const config = require(path.resolve(configPath))
      new EnvSetup(config)
    } else {
      console.log(
        '\x1b[31m%s\x1b[0m',
        '⚙️  [ENV SETUP]',
        'No config file path specified'
      )
    }
  } else {
    console.log(
      '\x1b[31m%s\x1b[0m',
      '⚙️  [ENV SETUP]',
      'No config file specified'
    )
  }
}
