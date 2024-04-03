import type {Request, Response} from 'express';
import fetch from 'node-fetch-commonjs';

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
    const prefix = `/spark-ui-proxy/${encodeURIComponent(req.params.url)}/`;

    const subPath = req.url.substring(prefix.length);

    console.log('req.params.url, req.url', req.params.url, req.url, 'subPath', subPath);

    const url = new URL(`${req.params.url}/${subPath}`);
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

    console.log('!!!!!!!!!!!!!!!!! RESP STATUS', resp.status, resp.headers, respBuffer.byteLength);


    res.status(resp.status);
    for (let [headerName, headerValue] of resp.headers.entries()) {
        if (['transfer-encoding', 'accept-ranges', 'content-encoding'].includes(headerName.toLowerCase())) {
            continue;
        }
        res.setHeader(headerName, headerValue);
    }

    console.log('RESP HEADERS', resp.headers, resp.headers.get("content-type")?.indexOf('text/html'));

    if (
        resp.headers.has("content-type") &&
        resp.headers.get("content-type")!.indexOf('text/html') > -1
    ) {
        let data = respBuffer.toString('utf8');
        // for (let match of data.matchAll(/(href|src)="\/([^"]*)"/g)) {
        //     const attribute = match[1]; // Get the attribute name
        //     const url = match[2]; // Get the URL

        //     // Prefix the URL with '/some/prefix'
        //     const prefixedUrl = `${prefix}${url}`;
        //     console.log({prefixedUrl});

        //     // Replace the original match with the prefixed URL
        //     data = data.replace(match[0], `${attribute}="${prefixedUrl}"`);
        // }

        for (let match of data.matchAll(/(\/proxy\/spark-application-[0-9]*\/)/g)) {
            const url = match[1]; // Get the URL
            data = data.replace(url, prefix);
        }

        res.send(data);
    } else {
        res.send(respBuffer);
    }
}
