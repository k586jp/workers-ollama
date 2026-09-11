import {Hono, Context as c, Next} from 'hono';

type Env = {
    Bindings: {
        OLLAMA_VPC: Fetcher,
        WORKER_TOKEN: string,
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
    const targetUrl = 'http://example.com' + url.pathname + url.search;

    const headers = new Headers(context.req.raw.headers);
    const json: RequestInit = {
        method: context.req.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(context.req.method) ? null : context.req.raw.body,
        // @ts-ignore  Body ストリーミング転送に必要なオプション
        duplex: 'half'
    };

    const proxyRequest = new Request(targetUrl, json);

    return context.env.OLLAMA_VPC.fetch(proxyRequest);
}

// ================================================================

async function useAuthentication(context: c, next: Next) {
    const token = context.req.header('Authorization');
    const apiKey = context.req.header('x-api-key');

    if (token !== 'Bearer ' + context.env.WORKER_TOKEN) {
        return context.json({ error: 'Unauthorized' }, 401);
    }

    if (apiKey !== context.env.SECRET_KEY) {
        return context.json({ error: 'Unauthorized' }, 401);
    }

    await next();
}
