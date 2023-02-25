# BYLG Fetcher

BYLG Fetcher is a small wrapper around fetch and Zod. It allows you to predefine headers and context and have a type-safe response.

## Installation

```bash
npm install @bylg/fetcher
yarn add @bylg/fetcher
pnpm add @bylg/fetcher
```

Zod is a peer dependency, so you will need to install that as well.

## Quick Start

```ts
import { FetcherClient } from "@bylg/fetcher";
import { z } from "zod";

const fetcherClient = new FetcherClient({
  ctx: z.object({
    baseUrl: z.string().url(),
  }),
  headers: {
    Authorization: z.string().min(1),
  },
  fetchers: {
    getTodo: async ({ ctx, get }, id: string) => {
      const data = await get(
        `${ctx.baseUrl}/items/${id}`,
        z.object({
          id: z.string(),
        })
      );
      return data;
    },
    createTodo: async ({ ctx, post }, input: { content: string }) => {
      const data = await post(
        `${ctx.baseUrl}/items/`,
        z.object({
          id: z.string(),
          content: z.string(),
        }),
        input
      );
      return data;
    },
  },
});

const todoFetcher = fetcherClient.createFetcher({
  ctx: {
    baseUrl: "https://example.com",
  },
  headers: { Authorization: "Bearer 123" },
});

const todo = await todoFetcher.getTodo("1");
//                                 ^?  (property) getTodo: (input: string) => Promise<{ id: string; }>

const newTodo = await todoFetcher.createTodo({ content: "test" });
//                                   ^?  (property) createTodo: (input: { content: string; }) => Promise<{ id: string; content: string; }>
```

## API

### FetcherClient

```ts
class FetcherClient {
  constructor(options: {
    ctx: ZodTypeAny;
    headers: ZodRawShape;
    fetchers: Record<string, Fetcher>;
  });
}
```

### get and post

```ts
type Fetch = typeof fetch;

type Get = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  options?: Parameters<Fetch>[1]
) => Promise<z.infer<Schema>>;

type Post = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  data?: any,
  options?: Parameters<Fetch>[1]
) => Promise<z.infer<Schema>>;
```
