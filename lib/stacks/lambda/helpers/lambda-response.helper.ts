type HeadersModel = Record<string, string> | 'ALLOW' | undefined;

/**
 * 
 * @param status 
 * @param body 
 * @param headers 
 * @returns 
 */
export const buildResponseBody = (status: number, body: any = undefined, headers: HeadersModel = undefined) => {
	let headersToUse: any = {};
	if (headers === 'ALLOW') {
		headersToUse = {
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': '*'
		};
	} else if (headers) headersToUse = headers;

	return {
		statusCode: status,
		headers: headersToUse,
		body: typeof body === 'string' ? body : JSON.stringify(body)
	};
};
