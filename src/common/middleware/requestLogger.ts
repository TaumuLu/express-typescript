import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { format } from 'date-fns'
import { StatusCodes } from 'http-status-codes'
import pino from 'pino'
import pinoHttp from 'pino-http'

import { env } from '@/common/utils/envConfig'

export const logger = pino({
	level: env.isProduction ? 'info' : 'debug',
	transport: env.isProduction
		? {
				target: 'pino-roll',
				options: {
					file: join('logs', 'log'),
					frequency: 'daily',
					mkdir: true,
					extension: `.${format(new Date(), 'yyyy-MM-dd')}-json`,
				},
			}
		: {
				target: 'pino-pretty',
				options: {
					colorize: true,
				},
			},
})

const getLogLevel = (status: number) => {
	if (status >= StatusCodes.INTERNAL_SERVER_ERROR) return 'error'
	if (status >= StatusCodes.BAD_REQUEST) return 'warn'
	return 'info'
}

const httpLogger = pinoHttp({
	logger,
	genReqId: (req, res) => {
		const existingID = req.id ?? req.headers['x-request-id']
		if (existingID) return existingID
		const id = randomUUID()
		res.setHeader('X-Request-Id', id)
		return id
	},
	customLogLevel: (_req, res) => getLogLevel(res.statusCode),
	customSuccessMessage: (req, res) => {
		if (res.statusCode === 404) {
			return 'resource not found'
		}
		return `${req.method} ${req.url} completed`
	},
	customErrorMessage: (req, res, err) => `request errored with status code: ${res.statusCode}`,
	// Only log response bodies in development
	serializers: {
		err: pino.stdSerializers.err,
		req: () => '',
		res: () => '',
	},
	wrapSerializers: false,
	quietReqLogger: true,
	quietResLogger: true,
})

export default httpLogger
