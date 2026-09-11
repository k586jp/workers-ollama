import {Hono, Context as c, Next} from 'hono';

type Env = {
    Bindings: {
        OLLAMA_VPC: Fetcher,
        AI_GATEWAY: Fetcher,
        SECRET_KEY: string
    }
};

const app = new Hono<Env>();
app.use('*', useAuthentication);
app.all('*', proxyHandler);
export default app;

// ================================================================

function proxyHandler(context: c) {
    const url = new URL(context.req.url);
    // const gatewayBaseUrl = 'https://ollama-gateway.k586.jp/custom/ollama-local';
    const targetUrl = 'http://ai-gateway/custom/ollama-local' + url.pathname + url.search;

    const headers = new Headers(context.req.raw.headers);
    headers.delete('host');
    headers.delete('x-api-key');
    const requestInit: RequestInit = {
        method: context.req.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(context.req.method) ? null : context.req.raw.body,
        // @ts-ignore  Body ストリーミング転送に必要なオプション
        duplex: 'half'
    };

    const proxyRequest = new Request(targetUrl, requestInit);
    // const requestInitCfProperties: RequestInit = {
    //     // @ts-ignore
    //     fetch: context.env.OLLAMA_VPC.fetch.bind(context.env.OLLAMA_VPC)
    // };
    // const result = fetch(proxyRequest, requestInitCfProperties);
    const json: RequestInit = {
        // @ts-ignore
        fetch: context.env.OLLAMA_VPC.fetch.bind(context.env.OLLAMA_VPC)
    }

    return context.env.AI_GATEWAY.fetch(proxyRequest, json);
}

// ================================================================

async function useAuthentication(context: c, next: Next) {
    const apiKey = context.req.header('x-api-key');

    if (apiKey !== context.env.SECRET_KEY) {
        return context.json({ error: 'Unauthorized' }, 401);
    }

    await next();
}
