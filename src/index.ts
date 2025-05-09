import { poweredBy } from 'hono/powered-by'
import { logger } from 'hono/logger'
import { Hono } from 'hono'
import { KVNamespace } from '@cloudflare/workers-types'
import { validateSignature, WebhookEvent } from '@line/bot-sdk';

type Bindings = {
    OBSIDIAN_LINE: KVNamespace
    LINE_CHANNEL_SECRET: string
}

type LineMessage = {
    timestamp: number
    messageId: string
    text: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(poweredBy())
app.use(logger())

app.get('/', (c) => c.text('Hono!!'))

app.get('/message', async (c) => {
    const list = await c.env.OBSIDIAN_LINE.list();
    const messages = await Promise.all(
        list.keys.map(async (key) => {
            const message = await c.env.OBSIDIAN_LINE.get(key.name);
            return message ? JSON.parse(message) as LineMessage : null;
        })
    );

    const filteredMessages = messages.filter((message): message is LineMessage => message !== null);
    
    // TTLを10分に設定して再度保存
    await Promise.all(
        filteredMessages.map(message => 
            c.env.OBSIDIAN_LINE.put(
                message.messageId,
                JSON.stringify(message),
                {
                    expirationTtl: 60 * 10 // 10 minutes
                }
            )
        )
    );

    return c.json(filteredMessages);
})

app.post('/callback', async (c) => {
    const signature = c.req.header('x-line-signature');
    if (!signature) {
        console.error('No signature')
        return c.json({ error: 'No signature' }, 400);
    }

    const body = await c.req.text();
    if (!validateSignature(body, c.env.LINE_CHANNEL_SECRET, signature)) {
        console.error('Invalid signature')
        return c.json({ error: 'Invalid signature' }, 400);
    }

    const events = JSON.parse(body).events as WebhookEvent[]
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const message: LineMessage = {
                timestamp: event.timestamp,
                messageId: event.message.id,
                text: event.message.text
            }
            await c.env.OBSIDIAN_LINE.put(
                message.messageId, 
                JSON.stringify(message),
                {
                    expirationTtl: 60 * 60 * 24 * 10 // 10 days
                }
            )
        }
    }

    return c.json({ message: 'OK' })
})

export default app
