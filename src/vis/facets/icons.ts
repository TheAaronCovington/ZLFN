import * as d3 from 'd3'
import { isVennRelevant, isTruthTableRelevant, isTimelineRelevant, isCounterRelevant } from '../utils/relevance'

export type FacetClick = (type: 'venn'|'truth'|'timeline'|'counter', opts: { shift: boolean; ctrl: boolean }, datum: any, target: Element) => void

export function createFacetIcons(nodeEnter: d3.Selection<SVGGElement, any, any, any>, onClick: FacetClick) {
	const iconGroup = nodeEnter.append('g').attr('class', 'facet-icons').attr('transform', 'translate(-20,-18)')
	iconGroup.append('circle').attr('r', 4).attr('cx', 0).attr('cy', 0).attr('fill', '#7ac7ff').attr('stroke', '#2aa4f4').attr('tabindex', 0).append('title').text('Open Venn facet')
	iconGroup.append('rect').attr('x', 8).attr('y', -4).attr('width', 8).attr('height', 8).attr('fill', '#c0c0c0').attr('stroke', '#888').attr('tabindex', 0).append('title').text('Open Truth Table facet')
	iconGroup.append('line').attr('x1', 18).attr('y1', 0).attr('x2', 26).attr('y2', 0).attr('stroke', '#aaa').attr('stroke-width', 2).attr('tabindex', 0).append('title').text('Open Timeline facet')
	iconGroup.append('path').attr('d', 'M 32,-5 L 38,5 L 26,5 Z').attr('fill', '#ff8a80').attr('stroke', '#ff5252').attr('tabindex', 0).append('title').text('Open Counter facet')

	iconGroup.each(function(d){
		const g = d3.select(this)
		g.select('circle').style('display', isVennRelevant(d) ? 'inline' : 'none')
		g.select('rect').style('display', isTruthTableRelevant(d) ? 'inline' : 'none')
		g.select('line').style('display', isTimelineRelevant(d) ? 'inline' : 'none')
		g.select('path').style('display', isCounterRelevant(d) ? 'inline' : 'none')
	})

	iconGroup.select('circle').on('click', function(event: any, d: any){ onClick('venn', { shift: !!event.shiftKey, ctrl: !!event.ctrlKey }, d, event.currentTarget as Element) })
	iconGroup.select('rect').on('click', function(event: any, d: any){ onClick('truth', { shift: !!event.shiftKey, ctrl: !!event.ctrlKey }, d, event.currentTarget as Element) })
	iconGroup.select('line').on('click', function(event: any, d: any){ onClick('timeline', { shift: !!event.shiftKey, ctrl: !!event.ctrlKey }, d, event.currentTarget as Element) })
	iconGroup.select('path').on('click', function(event: any, d: any){ onClick('counter', { shift: !!event.shiftKey, ctrl: !!event.ctrlKey }, d, event.currentTarget as Element) })

	return iconGroup
}
