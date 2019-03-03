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
  }

  listen(listener) {
    this.listeners.push(listener)
    const events = this.getEvents()
    events.forEach(listener)
  }

  getEvents() {
    try {
      return exists(this.eventsFileName) ? YAML.parse(fs.readFileSync(this.eventsFileName).toString()) : []
    } catch (error) {
      this.logger.error(error)
    }
  }

  add(event) {
    fs.appendFileSync(this.eventsFileName, YAML.stringify([{ts: new Date(), ...event}]))
    this.listeners.forEach(listener => listener(event))
  }

  deleteAll() {
    if (fs.existsSync(this.eventsFileName)) {
      fs.unlinkSync(this.eventsFileName)
    }
  }
}

module.exports = EventStore
