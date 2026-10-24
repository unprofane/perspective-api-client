# Changelog

## 4.0.0 (2026-10-24)

Published as `@unprofane/perspective-api-client`, maintained by Unprofane.

- The host is configurable: `new Perspective({apiKey, host})` or `PERSPECTIVE_API_HOST`. The default is `https://api.unprofane.com`, a drop-in for Google's Perspective API, which stops answering after 2026-12-31.
- Requests use Node's built-in `fetch`; Node 18 or later is required. axios and lodash are no longer dependencies. `ResponseError.response` keeps `status`, `statusText`, `headers` and `data`.
- An empty or over-long text is refused without sending a request (3.1.0 sent it anyway after rejecting).
- Tests run on `node:test`.


### 3.1.0 (2018-12-11)

- Increase max text length to 20480 characters.
- Drop support for node 4.

## 3.0.0 (2017-12-08)

- A `ResponseError` is thrown if the API returns an error.

## 2.0.0 (2017-12-03)

- Directly call to comment analyzer API rather than using Google's
discovery API to dynamically generate a client. This saves an API
request when doing an analysis.
- Validate text before it gets sent to the API.
- Rename `makeResource` to `getAnalyzeCommentPayload`.

## 1.1.0 (2017-12-02)

- Add `truncate` option.

## 1.0.0 (2017-12-02)

- First stable release.
