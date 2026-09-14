import {Hono, Context as c, Next} from 'hono';

type Env = {
    Bindings: {
        OLLAMA_VPC: Fetcher,
        WORKER_TOKEN: string
    }
};

const app = new Hono<Env>();
app.use('*', useAuthentication);
app.all('*', proxyHandler);
export default app;

// ================================================================

async function proxyHandler(context: c) {
    const modelPathMap: Record<string, string> = {
        'gemma4:e4b': '/gemma4-e4b',
        'gemma4:26b': '/gemma4-26b',
        'gemma4:31b': '/gemma4-31b',
    };
    let modelPrefix = '/gemma4-e4b';
    let requestBody: ArrayBuffer | null = null;

    if (!['GET', 'HEAD'].includes(context.req.method)) {
        try {
            requestBody = await context.req.raw.arrayBuffer();
            if (requestBody && requestBody.byteLength > 0) {
                const text = new TextDecoder().decode(requestBody);
                const bodyJson = JSON.parse(text) as { model?: string };

                if (bodyJson && bodyJson.model) {
                    modelPrefix = modelPathMap[bodyJson.model] || modelPrefix;
                }
            }
        } catch (e) {}
    }

    const url = new URL(context.req.url);
    const targetUrl = 'http://example.com' + modelPrefix + url.pathname + url.search;

    const headers = new Headers(context.req.raw.headers);
    const requestInit: RequestInit = {
        method: context.req.method,
        headers: headers,
        body: requestBody,
        // @ts-ignore  Body ストリーミング転送に必要なオプション
        duplex: 'half'
    };

    const proxyRequest = new Request(targetUrl, requestInit);

    return context.env.OLLAMA_VPC.fetch(proxyRequest);
}

// ================================================================

async function useAuthentication(context: c, next: Next) {
    const token = context.req.header('Authorization');

    if (token !== 'Bearer ' + context.env.WORKER_TOKEN) {
        return context.json({ error: 'Unauthorized' }, 401);
    }

    await next();
}
