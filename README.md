# perspective-api-client

[![npm](https://img.shields.io/npm/v/@unprofane/perspective-api-client.svg)](https://www.npmjs.com/package/@unprofane/perspective-api-client)

The Node.js client for the Perspective API, from [sloria/perspective-api-client](https://github.com/sloria/perspective-api-client) (archived), with the host configurable. Google's Perspective API stops answering after **2026-12-31**, and the original package hardcodes Google's address. This one posts the same request to any Perspective-compatible host. The default is [Unprofane's drop-in](https://unprofane.com/perspective/), which answers the same `comments:analyze` requests with the same JSON; set `host` to keep using Google's until then.

Maintained by [Unprofane](https://unprofane.com). MIT, like the original.

## Install

```bash
npm install @unprofane/perspective-api-client
```

Or keep every `require('perspective-api-client')` as it is and swap the package under it:

```bash
npm install perspective-api-client@npm:@unprofane/perspective-api-client
```

## Usage

```js
const Perspective = require('@unprofane/perspective-api-client');

// An Unprofane key (unprofane.com/app/), sent as ?key= like Google's.
const perspective = new Perspective({apiKey: process.env.PERSPECTIVE_API_KEY});

(async () => {
  const result = await perspective.analyze('you empty-headed animal food trough wiper!');
  console.log(result.attributeScores.TOXICITY.summaryScore.value);
})();
```

### The host

| | |
|---|---|
| default | `https://api.unprofane.com` |
| `new Perspective({apiKey, host})` | any Perspective-compatible host, such as `https://commentanalyzer.googleapis.com` until 2026-12-31 |
| `PERSPECTIVE_API_HOST` | the same, from the environment, when `host` is not passed |

The client appends `/v1alpha1/comments:analyze?key=…` to the host, as the original did to Google's.

### Specifying models

TOXICITY is requested by default. Pass `options.attributes` for others:

```js
const result = await perspective.analyze('fools!', {attributes: ['toxicity', 'insult', 'profanity']});
```

Unprofane serves TOXICITY, SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, PROFANITY, THREAT, SEXUALLY_EXPLICIT and FLIRTATION. It refuses the other New York Times attributes and the bridging ones (SPAM, UNSUBSTANTIAL, COMPASSION_EXPERIMENTAL and others) with the 400 Google gives a name it does not know, or drops them when the request sets `dropUnsupportedAttributes: true`.

### Passing an AnalyzeComment object

```js
const result = await perspective.analyze({
  comment: {text: 'hooray for tests'},
  requestedAttributes: {TOXICITY: {}, INSULT: {}},
  languages: ['en'],
});
```

### Options

- `attributes`: the attributes to request, as an array of names or an object.
- `doNotStore`: default `true`.
- `stripHTML`: strip HTML tags from the text, default `true`.
- `truncate`: cut text over 20,480 characters instead of refusing it, default `false`.
- `validate`: refuse an empty or over-long text before sending, default `true`.

### Errors

`ResponseError` (from the API, with `error.response.status` and `error.response.data`), `TextEmptyError` and `TextTooLongError`, all subclasses of `PerspectiveAPIClientError`, as before.

## What changed from 3.1.0

- The host is configurable (`host`, `PERSPECTIVE_API_HOST`), Unprofane's by default.
- Requests go through Node's built-in `fetch` (Node 18 or later); axios and lodash are gone. `error.response` keeps axios's `status`, `statusText`, `headers` and `data`.
- An invalid text is refused without sending a request.

## License

MIT. Copyright Steven Loria; changes since 3.1.0 copyright Unprofane.
