import * as d3 from 'd3'

export function appendOverlay(host: d3.Selection<SVGGElement, any, any, any>, roleLabel: string, pinned?: boolean) {
	const overlay = host.append('g').attr('class', 'facet-overlay').attr('aria-label', roleLabel).attr('role', 'dialog')
	if (pinned) overlay.attr('data-pinned', '1')
	overlay.append('rect').attr('x', -90).attr('y', -70).attr('width', 180).attr('height', 120).attr('rx', 8).attr('fill', 'rgba(20,20,30,0.92)').attr('stroke', '#40c4ff')
	overlay.append('text').attr('x', -84).attr('y', -54).attr('fill', '#9fb8ff').attr('font-size', 10).text('Esc to close • Drag nodes normally')
	const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onEsc) } }
	window.addEventListener('keydown', onEsc)
	overlay.append('text').attr('x', 72).attr('y', -56).attr('fill', '#ff8080').attr('font-size', 12).style('cursor','pointer').text('×').on('click', () => overlay.remove())
	return overlay
}

export function closeIfNotPinned(host: d3.Selection<SVGGElement, any, any, any>) {
	const existing = host.select('g.facet-overlay')
	if (!existing.empty() && existing.attr('data-pinned') !== '1') existing.remove()
}
