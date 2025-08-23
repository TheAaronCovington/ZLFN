import database from '../config/database.js'
import ZLFNObject from '../models/ZLFNObject.js'

async function run() {
  try {
    await database.connect()

    const sampleId = 'sample-1'

    // Clean remove existing to avoid stale data
    try {
      await ZLFNObject.deleteOne({ id: sampleId })
      console.log('[seedSample] Deleted existing object:', sampleId)
    } catch {}

    const setFields = {
      title: 'Sample Argument',
      markdownContent: '# Sample Argument\n\nSeeded object.',
      zlfnJson: {
        nodes: [
          { 
            id: 'core', 
            name: 'Core Claim',
            symbol: 'C',
            translation: 'This is the core claim of the sample argument',
            type: 'core', 
            label: 'Core Claim', 
            zone: 'arguments',
            zoneId: 'arguments',
            argumentId: 'sample-1',
            color: '#40c4ff',
            size: { radius: 30 },
            facets: {
              vennRelevant: true,
              truthTableRelevant: true,
              timelineRelevant: false,
              counterRelevant: false,
              rebuttalRelevant: false,
              noteRelevant: true
            },
            x: 0, 
            y: 0 
          },
          {
            id: 'premise1',
            name: 'First Premise',
            symbol: 'P1',
            translation: 'This is the first premise supporting the core claim',
            type: 'premise',
            label: 'First Premise',
            zone: 'premises',
            zoneId: 'premises',
            argumentId: 'sample-1',
            color: '#00ff88',
            size: { radius: 20 },
            facets: {
              vennRelevant: true,
              truthTableRelevant: true,
              timelineRelevant: false,
              counterRelevant: false,
              rebuttalRelevant: false,
              noteRelevant: true
            },
            x: -100,
            y: -50
          }
        ],
        edges: [
          {
            id: 'edge1',
            from: 'premise1',
            to: 'core',
            source: 'premise1',
            target: 'core',
            type: 'support',
            label: 'supports',
            color: '#00ff88',
            weight: 1
          }
        ],
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


