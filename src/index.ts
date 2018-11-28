import fs = require('fs')
import path = require('path')
import prettier = require('prettier')
import { IConfig } from './interfaces/index'

export default class EnvSetup {
  public vars: { [key: string]: string[] }
  public requiredKeys: Array<{ section: string; key: string }>

  constructor(config: IConfig) {
    // Check config
    if (!config) {
      this.log('No config specified')
      process.exit(0)
    }
    if (!config.envFilePath) {
      this.log(
        'No .env file path specified. Please provide a path to where your .env file is located as config.envFilePath'
      )
      process.exit(0)
    }
    if (!config.webpackConfigPath) {
      this.log(
        'No webpack config path specified. Please provide a path to your webpack config file as config.webpackConfigPath'
      )
    }
    if (!config.vars) {
      this.log(
        'No variables specified. Please provide config.vars - see README for details'
      )
      process.exit(0)
    }
    this.init(config)
  }

  public init(config: IConfig) {
    this.vars = config.vars
    this.requiredKeys = this.flattenVars(config.vars)
    this.checkEnvFile(config.envFilePath)
    if (config.webpackConfigPath) {
      this.checkWebpackConfig(config.webpackConfigPath)
    }
  }

  /**
   * Extracts the variable names from the `IConfig.vars` object
   * and returns an array of `{ section: string, key: string }` objects
   */
  public flattenVars = (vars: {
    [key: string]: string[]
  }): Array<{ section: string; key: string }> => {
    let requiredKeys = []
    Object.entries(vars).forEach(([section, keyNames]) => {
      requiredKeys = [
        ...requiredKeys.map(c => c),
        ...keyNames.map(keyName => ({ section, key: keyName }))
      ]
    })
    return requiredKeys
  }

  public checkEnvFile = filePath => {
    fs.readFile(filePath, (err, file) => {
      if (err) {
        // The file does not exist, add it
        this.log('Creating empty env vars template file:', filePath)
        return this.createOrUpdateFile(filePath, this.envFileContent(), true)
      }
      // The file exists, check if all variables are present
      const fileContent = file.toString()
      const lines = fileContent.split('\n')
      const unknownLines = []
      const variables = {}
      lines.forEach((line, i, array) => {
        if (line.trim().startsWith('#') || !line) {
          unknownLines.push(line)
          return
        }
        const key = line.split('=')[0].trim()
        const section = this.sectionFor(key)
        if (!section) {
          unknownLines.push(line)
        } else {
          variables[section] = (variables[section] || []).concat([line])
        }
      })
      // tslint:disable-next-line:no-string-literal
      variables['customVariables'] = unknownLines
      // Add all missing variables to variables object
      Object.entries(this.vars).forEach(([section, keyNames]) => {
        if (!variables[section]) {
          variables[section] = keyNames
        } else {
          variables[section] = keyNames.map(keyName => {
            const existingVariable = variables[section].find(
              key => this.extractKey(key) === keyName
            )
            if (existingVariable) {
              return existingVariable
            } else {
              return keyName
            }
          })
        }
      })
      const output = this.envFileContent(variables)
      this.createOrUpdateFile(filePath, output, true)
    })
  }

  public checkWebpackConfig = filePath => {
    fs.readFile(filePath, (err, file) => {
      if (err) {
        // The file does not exist, do nothing
        this.log(
          `Found no webpack config file at: ${path.relative('', filePath)}.\n`,
          'Create a webpack config file and make sure config.plugins includes a webpack.EnvironmentPlugin.'
        )
        return false
      }
      // The file exists, check if all variables are present
      const fileContent = prettier.format(file.toString(), {
        parser: 'babylon'
      })
      const missingKeys = []
      this.requiredKeys.forEach(key => {
        if (fileContent.indexOf(key.key) === -1) {
          missingKeys.push(key)
        }
      })
      if (missingKeys.length) {
        const lines: string[] = fileContent.split('\n')
        const pluginLineNumber = lines.findIndex(line =>
          /new webpack\.EnvironmentPlugin\({/.test(line)
        )
        const pluginEndLineNumber =
          lines.slice(pluginLineNumber).findIndex(line => /}\)/.test(line)) +
          pluginLineNumber
        if (pluginLineNumber > -1) {
          if (pluginEndLineNumber > pluginLineNumber) {
            const textStartIndex = lines[pluginLineNumber].indexOf(
              'new webpack'
            )
            const padding =
              lines[pluginLineNumber].substr(0, textStartIndex) + '  '
            missingKeys.forEach((key, i) => {
              if (i === 0) {
                const prevLine = lines[pluginEndLineNumber - 1]
                if (!prevLine.trim().endsWith(',')) {
                  lines[pluginEndLineNumber - 1] = prevLine + ','
                }
              }
              lines.splice(
                pluginEndLineNumber,
                0,
                padding + key.key + ': null,'
              )
            })
          } else {
            const lineParts = lines[pluginLineNumber].split(
              /webpack\.EnvironmentPlugin\({/
            )
            lines[pluginLineNumber] =
              lineParts[0] +
              'webpack.EnvironmentPlugin({\n' +
              missingKeys.map(key => key.key + ': null,').join('\n') +
              '\n' +
              lineParts[1]
          }
          this.createOrUpdateFile(filePath, lines)
        } else {
          this.log('Found no EnvironmentPlugin in webpack config.')
        }
      }
    })
  }

  public envFileContent = (vars?): string[] => {
    const envVariables = vars || this.vars
    const header = [
      '#########################',
      '# ENVIRONMENT VARIABLES #',
      '#########################',
      ''
    ]
    const friendlyNames = Object.keys(envVariables).map(k =>
      this.friendlyName(k)
    )
    const body = Object.keys(envVariables).map(key => {
      // Convert camelCased key to friendly name
      const friendlyName = this.friendlyName(key)
      const variables = envVariables[key]
        .map(variable => {
          if (!variable) {
            return null
          }
          if (variable.indexOf('=') > -1) {
            // Variable already has a value
            return `${variable.trim()}\n`
          } else if (variable.trim().startsWith('#')) {
            // This is a comment
            if (
              friendlyNames.includes(variable.replace('#', '').trim()) ||
              header.includes(variable.trim()) ||
              variable.trim() === '# --------------------- #'
            ) {
              return null
            } else {
              return `${variable.trim()}\n`
            }
          } else {
            return `${variable.trim()}=""\n`
          }
        })
        .filter(v => v !== null)
      if (key !== 'customVariables') {
        variables.sort()
      }
      const nrOfPads = Math.floor((21 - friendlyName.length) / 2)
      let padding = ''
      for (let i = nrOfPads; i > 0; i--) {
        padding += ' '
      }
      return `# --------------------- #
# ${padding}${friendlyName}
# --------------------- #
${variables.join('')}`
    })
    return [...header, ...body]
  }

  public createOrUpdateFile = (filePath, lines, isEnv = false) => {
    const content = isEnv
      ? lines.join('\n')
      : prettier.format(lines.join('\n'), { parser: 'babylon' })
    fs.writeFile(filePath, content, { encoding: 'utf8' }, err => {
      if (err) {
        this.log('Could not write to file', filePath)
        return
      }
      this.log('Completed setup of file:', path.relative('', filePath))
    })
  }

  private sectionFor = key => {
    let sectionName
    Object.keys(this.vars).find(section => {
      if (this.vars[section].includes(key)) {
        sectionName = section
        return true
      }
      return false
    })
    return sectionName
  }

  private extractKey = (key: string): string => {
    return key.substr(0, key.indexOf('='))
  }

  private friendlyName = (camelCased: string): string => {
    const friendlyName = camelCased.replace(/([A-Z])/g, $1 => ' ' + $1)
    return friendlyName.substr(0, 1).toUpperCase() + friendlyName.substr(1)
  }

  /**
   * Logs to stdout with some custom formatting
   */
  private log = (message, ...rest) =>
    console.log('\x1b[32m%s\x1b[0m', '⚙️  [ENV SETUP]', message, ...rest)
}

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
