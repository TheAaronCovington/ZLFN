import { useEffect, useRef, useState } from 'react'

export function useResizeObserver<T extends HTMLElement>() {
	const elementRef = useRef<T | null>(null)
	const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

	useEffect(() => {
		const el = elementRef.current
		if (!el) return

		const observer = new ResizeObserver(entries => {
			for (const entry of entries) {
				const cr = entry.contentRect
				setSize({ width: cr.width, height: cr.height })
			}
		})

		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	return { elementRef, size }
}


