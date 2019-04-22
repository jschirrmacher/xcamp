/*eslint-env node*/

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const exists = path => {
  try {
    return fs.existsSync(path)
  } catch (e) {
    return false
  }
}

class EventStore {
  constructor({basePath, logger}) {
    this.eventsFileName = path.join(basePath, 'events.yaml')
    this.logger = logger
    this.listeners = []
    this.ready = this.migrateIfNecessary(basePath)
      .then(() => this.changeStream = fs.createWriteStream(this.eventsFileName, {flags:'a'}))
  }

  migrateIfNecessary(basePath) {
    const versionFile = path.resolve(basePath, 'version.json')
    const eventsVersionNo = !exists(versionFile) ? 0 : JSON.parse(fs.readFileSync(versionFile).toString()).versionNo
    const migrationsDir = path.resolve(__dirname, 'migrations')
    const migrations = fs.readdirSync(migrationsDir)
      .filter(name => parseInt(name.replace('from_', '')) >= eventsVersionNo)
      .reverse()
    const currentVersionNo = eventsVersionNo + migrations.length

    if (eventsVersionNo < currentVersionNo) {
      return new Promise(resolve => {
        this.logger.info(`Migrating data from ${eventsVersionNo} to ${currentVersionNo}`)
        const outputStream = fs.createWriteStream(this.eventsFileName + '.migrated')
        outputStream.on('finish', () => {
          fs.renameSync(this.eventsFileName, path.join(basePath, `events-${eventsVersionNo}.yaml`))
          fs.renameSync(this.eventsFileName + '.migrated', this.eventsFileName)
          fs.writeFileSync(versionFile, JSON.stringify({versionNo: currentVersionNo}))
          this.logger.info('Migration successful')
          resolve()
        })
        const migratorPipe = migrations
          .reduce((pipe, migratorName) => {
            return require(path.resolve(migrationsDir, migratorName))(pipe)
          }, event => outputStream.write(YAML.stringify([event])))
        YAML.parse(fs.readFileSync(this.eventsFileName).toString()).forEach(event => migratorPipe(event))
        outputStream.end()
      })
    } else {
      return Promise.resolve()
    }
  }

  listen(listener) {
    this.listeners.push(listener)
  }

  async replay() {
    const self = this
    function handleEvent(data) {
      try {
        const event = YAML.parse(data)
        self.listeners.forEach(listener => listener(event, 'replay'))
      } catch (error) {
        self.logger.error(error)
      }
    }

    await this.ready
    const data = fs.readFileSync(this.eventsFileName).toString()
    const lines = data.split('\n')
    const entry = []
    lines.forEach(line => {
      if (line.match(/^- /) && entry.length) {
        handleEvent(entry.join('\n'))
        entry.length = 0
      }
      entry.push(line.substr(2))
    })
    if (entry.length) {
      handleEvent(entry.join('\n'))
    }
  }

  async add(event) {
    await this.ready
    this.changeStream.write(YAML.stringify([{ts: new Date(), ...event}]))
    this.listeners.forEach(listener => listener(event, 'new'))
  }

  deleteAll() {
    if (fs.existsSync(this.eventsFileName)) {
      fs.unlinkSync(this.eventsFileName)
    }
  }

  end() {
    this.changeStream.end()
  }
}

module.exports = EventStore
