# @thanaen/api-client

Typed JavaScript/TypeScript client for the [Thanaen public API](https://api.thanaen.dev).

## Install

```sh
bun add @thanaen/api-client
# or npm i / pnpm add / yarn add
```

## Usage

```ts
import { ThanaenApiClient } from "@thanaen/api-client";

const client = new ThanaenApiClient();
// override baseUrl (useful for tests):
// const client = new ThanaenApiClient({ baseUrl: "http://localhost:3000" });

const paniers = await client.paniers.list();
console.log(paniers.data, paniers.lastUpdated);

const movie = await client.cinema.movies.get("317669");
console.log(movie.data.title);
```

## Error handling

```ts
import { ThanaenApiClient, NotFoundError, UpstreamError } from "@thanaen/api-client";

try {
  await client.paniers.get(999999);
} catch (err) {
  if (err instanceof NotFoundError) {
    // resource does not exist
  } else if (err instanceof UpstreamError) {
    // the API failed to fetch upstream data (502)
  }
}
```

## Options

```ts
new ThanaenApiClient({
  baseUrl: "https://api.thanaen.dev", // default
  fetch: customFetch, // inject your own fetch implementation
  headers: { "X-Extra": "value" }, // additional headers on every request
});
```

## Version

The client sends `User-Agent` and `X-Client-Version` headers on every request, including
the client version and the API version it was built against (`BUILT_FOR_API_VERSION`).

```ts
import { CLIENT_VERSION, BUILT_FOR_API_VERSION } from "@thanaen/api-client";
```
