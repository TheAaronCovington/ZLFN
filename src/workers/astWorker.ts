// Web Worker: parse logical expressions to AST off the main thread
import { parseExpressionToAst } from '../services/logic'

self.onmessage = (e: MessageEvent) => {
	try {
		const { reqId, expression } = e.data || {}
		const ast = parseExpressionToAst(expression)
		;(self as any).postMessage({ reqId, ast })
	} catch (error) {
		const { reqId } = e.data || {}
		;(self as any).postMessage({ reqId, error: String(error) })
	}
}


