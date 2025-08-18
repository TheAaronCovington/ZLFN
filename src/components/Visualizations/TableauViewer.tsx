import React, { useEffect, useRef } from 'react'

export interface TableauViewerProps {
	url: string
	title?: string
}

export const TableauViewer: React.FC<TableauViewerProps> = ({ url, title }) => {
	const iframeRef = useRef<HTMLIFrameElement | null>(null)

	useEffect(() => {
		// Future: add postMessage hooks if needed
	}, [])

	return (
		<div style={{ width: '100%', height: 560, position: 'relative', background: 'var(--ai-bg-primary)', border: '1px solid rgba(64,196,255,0.3)', borderRadius: 12 }}>
			{title && (
				<div style={{ padding: '8px 12px', color: 'var(--ai-text-secondary)' }}>{title}</div>
			)}
			<iframe
				ref={iframeRef}
				src={url}
				title={title || 'Tableau Viewer'}
				style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
				loading="lazy"
			/>
		</div>
	)
}

export default TableauViewer


