export const DEFAULT_ZONES = [
	{ id: 'arguments', name: 'Arguments', color: '#9e9e9e', xRange: [40, 160] as [number, number], yRange: [110, 220] as [number, number] },
	{ id: 'premises', name: 'Premises', color: '#20B2AA', xRange: [180, 460] as [number, number], yRange: [110, 530] as [number, number] },
	{ id: 'terms', name: 'Terms', color: '#4169E1', xRange: [500, 820] as [number, number], yRange: [110, 530] as [number, number] },
	{ id: 'conclusions', name: 'Conclusions', color: '#9370DB', xRange: [860, 1180] as [number, number], yRange: [110, 530] as [number, number] },
	{ id: 'fallacies', name: 'Fallacies', color: '#DC143C', xRange: [1220, 1380] as [number, number], yRange: [110, 360] as [number, number] },
	{ id: 'informal', name: 'Informal', color: '#ffb74d', xRange: [180, 460] as [number, number], yRange: [540, 620] as [number, number] },
	{ id: 'temporal', name: 'Temporal', color: '#64b5f6', xRange: [500, 820] as [number, number], yRange: [540, 620] as [number, number] }
]

export const COLORS = {
	primary: '#40c4ff',
	secondary: '#ff8a80',
	success: '#4caf50',
	warning: '#ff9800',
	error: '#f44336',
	info: '#2196f3'
}

export const PERFORMANCE_THRESHOLDS = {
	small: 50,
	medium: 100,
	large: 200,
	extraLarge: 500
}
