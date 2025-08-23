import database from '../config/database.js'
import ZLFNObject from '../models/ZLFNObject.js'

async function run() {
  try {
    await database.connect()

    const sampleId = 'sample-1'

    const setFields = {
      title: 'Sample Argument',
      markdownContent: '# Sample Argument\n\nSeeded object.',
      zlfnJson: {
        nodes: [
          { id: 'core', type: 'core', label: 'Core Claim', zone: 'Main', x: 0, y: 0 }
        ],
        edges: [],
        dependencies: []
      },
      'metadata.author': 'system',
      'metadata.tags': ['seed'],
      'metadata.isPublic': true
    }

    const doc = await ZLFNObject.findOneAndUpdate(
      { id: sampleId },
      { $set: setFields, $setOnInsert: { id: sampleId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    console.log('[seedSample] Upserted sample object:', doc.id)
  } catch (err) {
    console.error('[seedSample] Error:', err)
    process.exitCode = 1
  } finally {
    await database.disconnect()
  }
}

run()


