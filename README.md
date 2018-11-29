# env-setup

## Work in progress

### Example usage

Create a configuration file

```js
// config.js
module.exports = {
  envFilePath: '.env',
  vars: { testVariables: ['VAR_1', 'VAR_2'] }
}
```

Add npm script and pass the path to your config file as `--config` argument

```json
// package.json
{
  "scripts": {
    "prestart": "env-setup --config config.js"
  }
}
```
