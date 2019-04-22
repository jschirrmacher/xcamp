/*eslint-env node*/

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const es = require('event-stream')

const exists = path => {
  try {
    return fs.existsSync(path)
  } catch (e) {
    return false
  }
}

class EventStore {
  constructor({basePath, logger}) {
    this.eventsFileName = path.join(basePath, 'events.json')
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
        const fileExt = eventsVersionNo <= 3 ? 'yaml' : 'json'
        const oldEventsFile = path.join(basePath, 'events.' + (fileExt))
        const migrationFile = this.eventsFileName + '.migrated'
        const outputStream = fs.createWriteStream(migrationFile)
        outputStream.on('finish', () => {
          fs.renameSync(oldEventsFile, path.join(basePath, `events-${eventsVersionNo}.${fileExt}`))
          fs.renameSync(migrationFile, this.eventsFileName)
          fs.writeFileSync(versionFile, JSON.stringify({versionNo: currentVersionNo}))
          this.logger.info('Migration successful')
          resolve()
        })
        const migratorPipe = migrations
          .reduce((pipe, migratorName) => {
            return require(path.resolve(migrationsDir, migratorName))(pipe)
          }, event => outputStream.write(JSON.stringify(event) + '\n'))
        if (eventsVersionNo <= 3) {
          YAML.parse(fs.readFileSync(path.join(basePath, 'events.yaml')).toString())
            .forEach(event => migratorPipe(event))
        } else {
          fs.createReadStream(this.eventsFileName)
            .pipe(es.split())
            .pipe(es.parse())
            .pipe(es.mapSync(migratorPipe))
        }
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
    await this.ready
    const self = this
    const readStream = fs.createReadStream(this.eventsFileName)
      .pipe(es.split())
      .pipe(es.parse())
      .pipe(es.mapSync(event => {
        try {
          self.listeners.forEach(listener => listener(event, 'replay'))
        } catch (error) {
          self.logger.error(error)
        }
      }))
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
