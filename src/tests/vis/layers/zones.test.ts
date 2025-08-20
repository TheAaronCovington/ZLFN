import { describe, it, expect, beforeEach } from 'vitest'
import * as d3 from 'd3'
import { renderZones } from '../../../vis/layers/zones'

describe('zones layer', () => {
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
	let container: d3.Selection<SVGGElement, unknown, null, undefined>

	beforeEach(() => {
		// Create a test SVG container
		document.body.innerHTML = '<div id="test-container"></div>'
		svg = d3.select('#test-container').append('svg')
		container = svg.append('g')
	})

	it('should render zones with correct attributes', () => {
		const zones = [
			{
				id: 'test-zone',
				name: 'Test Zone',
				color: '#ff0000',
				xRange: [0, 100] as [number, number],
				yRange: [0, 50] as [number, number]
			}
		]

		const zoneGroup = renderZones(container, zones)

		// Check that zone group was created
		expect(zoneGroup.node()).toBeTruthy()
		expect(zoneGroup.attr('class')).toBe('zones')

		// Check that zone rectangle was created
		const rect = zoneGroup.select('rect.zone')
		expect(rect.node()).toBeTruthy()
		expect(rect.attr('x')).toBe('0')
		expect(rect.attr('y')).toBe('0')
		expect(rect.attr('width')).toBe('100')
		expect(rect.attr('height')).toBe('50')
		expect(rect.attr('fill')).toBe('#ff0000')

		// Check that zone label was created
		const text = zoneGroup.select('text.zone-label')
		expect(text.node()).toBeTruthy()
		expect(text.text()).toBe('Test Zone')
		expect(text.attr('x')).toBe('50') // Center of zone
		expect(text.attr('fill')).toBe('#ff0000')
	})

	it('should handle multiple zones', () => {
		const zones = [
			{
				id: 'zone1',
				name: 'Zone 1',
				color: '#ff0000',
				xRange: [0, 100] as [number, number],
				yRange: [0, 50] as [number, number]
			},
			{
				id: 'zone2',
				name: 'Zone 2',
				color: '#00ff00',
				xRange: [100, 200] as [number, number],
				yRange: [50, 100] as [number, number]
			}
		]

		const zoneGroup = renderZones(container, zones)

		// Check that both zones were created
		const rects = zoneGroup.selectAll('rect.zone')
		expect(rects.size()).toBe(2)

		const texts = zoneGroup.selectAll('text.zone-label')
		expect(texts.size()).toBe(2)
	})

	it('should handle empty zones array', () => {
		const zoneGroup = renderZones(container, [])

		// Should create group but no zones
		expect(zoneGroup.node()).toBeTruthy()
		expect(zoneGroup.selectAll('rect.zone').size()).toBe(0)
		expect(zoneGroup.selectAll('text.zone-label').size()).toBe(0)
	})
})
