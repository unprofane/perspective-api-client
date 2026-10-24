'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Perspective = require('.');

const {TextEmptyError, TextTooLongError, ResponseError} = Perspective;

const MOCK_RESPONSE = {
  attributeScores: {
    TOXICITY: {
      spanScores: [{begin: 0, end: 56, score: {value: 0.8728314, type: 'PROBABILITY'}}],
      summaryScore: {value: 0.8728314, type: 'PROBABILITY'},
    },
  },
  languages: ['en'],
};

// A fetch that answers with `status` and `body`, and records each request.
const fakeFetch = (status, body) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({url, init});
    return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
  };
  return {calls, fetch};
};

const createPerspective = options => new Perspective(Object.assign({apiKey: 'mock-key'}, options));

test('requires apiKey', () => {
  assert.throws(() => new Perspective(), Error);
});

test('posts to Unprofane by default, Google or any host when asked', () => {
  const previous = process.env.PERSPECTIVE_API_HOST;
  delete process.env.PERSPECTIVE_API_HOST;
  assert.equal(createPerspective().url, 'https://api.unprofane.com/v1alpha1/comments:analyze');
  assert.equal(
    createPerspective({host: 'https://commentanalyzer.googleapis.com/'}).url,
    'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze'
  );
  process.env.PERSPECTIVE_API_HOST = 'http://127.0.0.1:8902';
  assert.equal(createPerspective().url, 'http://127.0.0.1:8902/v1alpha1/comments:analyze');
  if (previous === undefined) {
    delete process.env.PERSPECTIVE_API_HOST;
  } else {
    process.env.PERSPECTIVE_API_HOST = previous;
  }
});

test('analyze (mocked)', async () => {
  const {calls, fetch} = fakeFetch(200, MOCK_RESPONSE);
  const p = createPerspective({fetch, host: 'https://example.test'});
  const result = await p.analyze('testing is for dummies');
  assert.deepEqual(result, MOCK_RESPONSE);
  assert.equal(calls[0].url, 'https://example.test/v1alpha1/comments:analyze?key=mock-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    comment: {text: 'testing is for dummies'},
    requestedAttributes: {TOXICITY: {}},
    doNotStore: true,
  });
});

test('analyze (mocked) handles errors from API', async () => {
  const {fetch} = fakeFetch(400, {error: {message: 'invalid!'}});
  const error = await createPerspective({fetch}).analyze('this will fail').catch(error => error);
  assert.ok(error instanceof ResponseError);
  assert.equal(error.message, 'invalid!');
  assert.equal(error.response.status, 400);
  assert.equal(error.response.data.error.message, 'invalid!');
});

test('analyze (mocked) handles errors with no message', async () => {
  const {fetch} = fakeFetch(400, {error: {code: 400}});
  const error = await createPerspective({fetch}).analyze('this will fail').catch(error => error);
  assert.ok(error instanceof ResponseError);
  assert.match(error.message, /Request failed with status code 400/);
  assert.equal(error.response.data.error.code, 400);
});

test('a network failure is a ResponseError with no response', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const error = await createPerspective({fetch}).analyze('hello').catch(error => error);
  assert.ok(error instanceof ResponseError);
  assert.equal(error.response, undefined);
});

test('an invalid text is refused before any request', async () => {
  const {calls, fetch} = fakeFetch(200, MOCK_RESPONSE);
  await assert.rejects(createPerspective({fetch}).analyze(''), TextEmptyError);
  assert.equal(calls.length, 0);
});

test('strips tags by default', () => {
  const payload = createPerspective().getAnalyzeCommentPayload('<p>good test</p>');
  assert.equal(payload.comment.text, 'good test');
});

test('stripHTML false', () => {
  const payload = createPerspective().getAnalyzeCommentPayload('<p>good test</p>', {stripHTML: false});
  assert.equal(payload.comment.text, '<p>good test</p>');
});

test('doNotStore is true by default', () => {
  assert.equal(createPerspective().getAnalyzeCommentPayload('good test').doNotStore, true);
});

test('truncate', () => {
  const p = createPerspective();
  const text = 'x'.repeat(20481);
  assert.throws(() => p.getAnalyzeCommentPayload(text), Error);
  assert.equal(p.getAnalyzeCommentPayload(text, {truncate: true}).comment.text, 'x'.repeat(20480));
  assert.throws(() => p.getAnalyzeCommentPayload(text, {truncate: false}), Error);
});

test('analyze with attributes passed as an array', () => {
  const payload = createPerspective().getAnalyzeCommentPayload('good test', {
    attributes: ['unsubstantial', 'spam'],
  });
  assert.ok(payload.requestedAttributes.UNSUBSTANTIAL);
  assert.ok(payload.requestedAttributes.SPAM);
});

test('analyze with AnalyzeComment object passed', () => {
  const requestPayload = {
    comment: {text: 'hooray for tests'},
    requestedAttributes: {UNSUBSTANTIAL: {}, SPAM: {}},
    clientToken: 'test',
    doNotStore: true,
  };
  assert.deepEqual(createPerspective().getAnalyzeCommentPayload(requestPayload), requestPayload);
});

test('text is required', () => {
  const p = createPerspective();
  assert.throws(() => p.getAnalyzeCommentPayload(), TextEmptyError);
  assert.throws(() => p.getAnalyzeCommentPayload(''), TextEmptyError);
});

test('more than 20480 characters in text is invalid', () => {
  assert.throws(
    () => createPerspective().getAnalyzeCommentPayload('x'.repeat(20481)),
    TextTooLongError
  );
});

if (process.env.PERSPECTIVE_API_KEY && process.env.TEST_INTEGRATION) {
  test('integration:analyze', async () => {
    const p = new Perspective({apiKey: process.env.PERSPECTIVE_API_KEY});
    const result = await p.analyze('testing is for dummies', {doNotStore: true});
    assert.ok(result.attributeScores.TOXICITY);
  });
}
