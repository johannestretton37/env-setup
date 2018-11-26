export interface IConfig {
  envFilePath: string
  webpackConfigPath: string
  vars: {
    [key: string]: string[]
  }
}
