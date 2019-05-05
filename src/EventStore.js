/*eslint-env node*/

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const stream = require('stream')
const es = require('event-stream')

const exists = path => {
  try {
    return fs.existsSync(path)
  } catch (e) {
    return false
  }
}

class JsonStringify extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    this.push(JSON.stringify(event) + '\n')
    callback()
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
      .map(migration => require(path.resolve(migrationsDir, migration)))
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
        const readStream = eventsVersionNo <= 3
          ? es.readArray(YAML.parse(fs.readFileSync(path.join(basePath, 'events.yaml')).toString()))
          : fs.createReadStream(this.eventsFileName).pipe(es.split()).pipe(es.parse())

        migrations.reduce((stream, migrator) => stream.pipe(new migrator()), readStream)
          .pipe(new JsonStringify())
          .pipe(outputStream)
      })
    } else {
      return Promise.resolve()
    }
  }

  listen(listener) {
    this.listeners.push(listener)
  }

  static assert(event, condition, message) {
    if (!condition) {
      const originalFunc = Error.prepareStackTrace
      const err = new Error()
      Error.prepareStackTrace = (err, stack) => stack.map(e => e.getFileName())
      const currentfile = err.stack.shift()
      const callerFile = err.stack.find(s => s !== currentfile).split(/[\\/]/).pop()
      Error.prepareStackTrace = originalFunc;
      throw `Read model '${callerFile}', event '${event.type}' (${event.ts}): ${message}`
    }
  }

  async replay() {
    await this.ready
    const self = this
    fs.createReadStream(this.eventsFileName)
      .pipe(es.split())
      .pipe(es.parse())
      .pipe(es.mapSync(event => {
        try {
          self.listeners.forEach(listener => {
            listener(event, (condition, message) => EventStore.assert(event, condition, message), 'replay')
          })
        } catch (error) {
          self.logger.error(error)
        }
      }))
  }

  async add(event) {
    await this.ready
    const {type, ...rest} = event
    this.changeStream.write(JSON.stringify({ts: new Date(), type, ...rest}) + '\n')
    this.listeners.forEach(listener => {
      listener(event, (condition, message) => EventStore.assert(event, condition, message), 'new')
    })
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
