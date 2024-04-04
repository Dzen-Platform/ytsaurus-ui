import type {Request, Response} from 'express';
import fetch from 'node-fetch-commonjs';
import {
    YTApiUserSetup,
    getUserYTApiSetup,
} from '../components/requestsSetup';
import axios from 'axios';
import { LRUCacheWithTTL } from '../components/utils';

export class SparkProxyError extends Error {}

export class BadTokenError extends SparkProxyError {
    constructor(code: number, response: string) {
        super(`Ytauth BadTokenError. Code = ${code}. Message = ${response}`);
    }
}

export class UnexpectedError extends SparkProxyError {
    constructor(message?: string, code?: number, response?: any, inner?: Error) {
        super(
            `Ytauth UnexpectedError. Message = "${message}", ` +
                `code = ${code}, response = ${JSON.stringify(response)}, inner = ${inner}`,
        );
    }
}

const ALL_HEADERS = [
    'accept',
    'accept-language',
    'accept-patch',
    'accept-ranges',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-allow-origin',
    'access-control-expose-headers',
    'access-control-max-age',
    'access-control-request-headers',
    'access-control-request-method',
    'age',
    'allow',
    'alt-svc',
    'authorization',
    'cache-control',
    'connection',
    'content-disposition',
    'content-encoding',
    'content-language',
    'content-length',
    'content-location',
    'content-range',
    'content-type',
    'cookie',
    'date',
    'etag',
    'expect',
    'expires',
    'forwarded',
    'from',
    'host',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-unmodified-since',
    'last-modified',
    'location',
    'origin',
    'pragma',
    'proxy-authenticate',
    'proxy-authorization',
    'public-key-pins',
    'range',
    'referer',
    'retry-after',
    'sec-websocket-accept',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-protocol',
    'sec-websocket-version',
    'set-cookie',
    'strict-transport-security',
    'tk',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'user-agent',
    'vary',
    'via',
    'warning',
    'www-authenticate',
];
export async function handleSparkProxy(req: Request, res: Response) {
    let { url: sparkUiUrl, proxyUrl } = await getSparkUiUrl(req, req.params.cluster, req.params.operation);
    
    const prefix = `${proxyUrl}/`;

    const subPath = req.url.substring(prefix.length);

    const url = new URL(`${sparkUiUrl}/${subPath}`);
    const headers = req.headers;

    headers.host = url.host;

    console.log('!!!!!!!!!!! URL', url.toString());

    const resp = await fetch(url.toString(), {
        headers: Object.fromEntries(
            Object.entries(headers)
                .filter(([k, v]) => !!v && v.length > 0 && ALL_HEADERS.includes(k))
                .map(([k, v]) => [k, v + '']),
        ),
    });

    const respBuffer = Buffer.from(await resp.arrayBuffer());

    res.status(resp.status);
    for (let [headerName, headerValue] of resp.headers.entries()) {
        if (
            ['transfer-encoding', 'accept-ranges', 'content-encoding'].includes(
                headerName.toLowerCase(),
            )
        ) {
            continue;
        }
        res.setHeader(headerName, headerValue);
    }

    if (
        resp.headers.has('content-type') &&
        resp.headers.get('content-type')!.indexOf('text/html') > -1
    ) {
        let data = respBuffer.toString('utf8');
        let nothingFound = true;
        for (let match of data.matchAll(/(\/proxy\/spark-application-[0-9]*\/)/g)) {
            const url = match[1]; // Get the URL
            data = data.replace(url, prefix);
            nothingFound = false;
        }

        if (nothingFound) {
            res.status(400);
            res.end(`
                <div style="display: flex; min-height: 100%; align-items: center; justify-content: center; font-weight: 800; font-family: Roboto, Arial; color: red;">
                    To utilize the Spark UI, enable reverse proxy mode by adding: "--conf spark.ui.reverseProxy=true".
                </div>
            `);
            return;
        }
        res.send(data);
    } else {
        res.send(respBuffer);
    }
}


// Create an LRU cache with a TTL of 10 minutes (adjust TTL as needed)
const getOperationCache = new LRUCacheWithTTL<any>(10000, 600000);

async function getOperation(req: Request, config: YTApiUserSetup, operationId: string): Promise<any> {
    const { authHeaders, proxyBaseUrl } = config;
    const xYTCorrelationId = `${req.ctx.get('requestId')}.fetchClusterParams`;

    const cacheKey = {operationId, authHeaders, proxyBaseUrl };

    // Check if operationId exists in cache
    if (getOperationCache.has(cacheKey)) {
        return getOperationCache.get(cacheKey); // Return cached data
    }

    let resp = await axios.request<{ login: string; csrf_token: string }>({
        url: `${proxyBaseUrl}/api/v4/get_operation?operation_id=${operationId}`,
        method: 'GET',
        headers: {
            ...authHeaders,
            'X-YT-Correlation-Id': xYTCorrelationId,
        },
        timeout: 10000,
    });

    const responseData = resp.data;

    // Cache the response with the operationId as the key
    getOperationCache.set(cacheKey, responseData);

    return responseData;
}


async function getSparkUiUrl(req: Request, cluster: string,  operationId: string) {
    const cfg = getUserYTApiSetup(cluster, req);
    const operation = await getOperation(req, cfg, req.params.operation)
    return {
        url: operation?.runtime_parameters?.annotations?.description?.["Web UI"],
        proxyUrl: `/api/spark-ui/${cluster}/${operationId}/proxy`
    }
}

async function checkSparkUi(req: Request, cluster: string, operationId: string) {
    let { url, proxyUrl } = await getSparkUiUrl(req, cluster, operationId);

    try {
        await axios.get(url, { timeout: 3000 });

        return {
            state: "ONLINE", 
            url,
            proxyUrl
        }
    } catch (err) {
        return {
            state: "OFFLINE", 
            url,
            proxyUrl
        }
    }

}

function axiosErrorToJson(err: any) {
    if (err.response) {
        return {
            message: err.toString(),
            response: err.response.data,
        }
    }
    return {
        message: err.toString()
    }
}

export async function handleCheckSparkUiState(req: Request, res: Response) {
    try {
        res.send(await checkSparkUi(req, req.params.cluster, req.params.operation));
    } catch (err: any) {
        res.status(500);
        res.send({
            error: axiosErrorToJson(err)
        })
    }
}
