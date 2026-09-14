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
    let modelPrefix = '';
    let bodyStream: ReadableStream | string | null = context.req.raw.body;

    if (!['GET', 'HEAD'].includes(context.req.method)) {
        const clonedRequest = context.req.raw.clone();
        try {
            const bodyJson = await clonedRequest.json() as { model?: string };
            if (bodyJson && bodyJson.model) {
                modelPrefix = modelPathMap[bodyJson.model] || modelPathMap['gemma4:e4b'];
            }
        } catch (e) {
            modelPrefix = modelPathMap['gemma4:e4b'];
        }
    }

    const url = new URL(context.req.url);
    const targetUrl = 'http://example.com' + modelPrefix + url.pathname + url.search;

    const headers = new Headers(context.req.raw.headers);
    const requestInit: RequestInit = {
        method: context.req.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(context.req.method) ? null : bodyStream,
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
