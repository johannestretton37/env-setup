import EnvSetup from './EnvSetup'
import { IConfig } from './interfaces'

describe('constructor', () => {
  it('should set envFilePath if provided', () => {
    const config: IConfig = {
      envFilePath: '/path/to/.env',
      webpackConfigPath: '/path/to/webpack',
      vars: {}
    }
    const envSetup = new EnvSetup(config)
    expect(envSetup.vars).toEqual(config.vars)
  })
})
