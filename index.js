'use strict';
const striptags = require('striptags');

// Google's Perspective API stops answering after 2026-12-31. The host is an
// option (or PERSPECTIVE_API_HOST); the default is Unprofane's drop-in,
// which answers the same requests with the same JSON.
const DEFAULT_HOST = 'https://api.unprofane.com';
const ANALYZE_PATH = '/v1alpha1/comments:analyze';
const MAX_LENGTH = 20480;

class PerspectiveAPIClientError extends Error {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'PerspectiveAPIClientError';
  }
}

class TextEmptyError extends PerspectiveAPIClientError {
  constructor() {
    super('text must not be empty');
    this.name = 'TextEmptyError';
  }
}

class TextTooLongError extends PerspectiveAPIClientError {
  constructor() {
    super(`text must not be greater than ${MAX_LENGTH} characters in length`);
    this.name = 'TextTooLongError';
  }
}

class ResponseError extends PerspectiveAPIClientError {
  constructor(message, response) {
    super(message);
    this.response = response;
    this.name = 'ResponseError';
  }
}

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

// A deep merge of plain objects, as lodash's merge did for the payload.
const merge = (target, source) => {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) {
      continue;
    }
    out[key] = isObject(out[key]) && isObject(source[key]) ? merge(out[key], source[key]) : source[key];
  }
  return out;
};

class Perspective {
  constructor(options) {
    this.options = options || {};
    if (!this.options.apiKey) {
      throw new Error('Must provide options.apiKey');
    }
    const host = this.options.host || process.env.PERSPECTIVE_API_HOST || DEFAULT_HOST;
    this.url = host.replace(/\/+$/, '') + ANALYZE_PATH;
    this.fetch = this.options.fetch || globalThis.fetch;
  }

  analyze(text, options) {
    return new Promise((resolve, reject) => {
      let resource;
      try {
        resource = this.getAnalyzeCommentPayload(text, options);
      } catch (error) {
        reject(error);
        return;
      }
      const url = `${this.url}?key=${encodeURIComponent(this.options.apiKey)}`;
      this.fetch(url, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(resource),
      })
        .then(async res => {
          const raw = await res.text();
          let data = raw;
          try {
            data = JSON.parse(raw);
          } catch (_) {}
          if (res.ok) {
            resolve(data);
            return;
          }
          const response = {
            status: res.status,
            statusText: res.statusText,
            headers: Object.fromEntries(res.headers),
            data,
          };
          const message =
            (isObject(data) && isObject(data.error) && data.error.message) ||
            `Request failed with status code ${res.status}`;
          reject(new ResponseError(message, response));
        })
        .catch(error => {
          reject(error instanceof ResponseError ? error : new ResponseError(error.message, undefined));
        });
    });
  }

  getAnalyzeCommentPayload(text, options) {
    const opts = options || {};
    const stripHTML = opts.stripHTML == undefined ? true : opts.stripHTML;
    const truncate = opts.truncate == undefined ? false : opts.truncate;
    const doNotStore = opts.doNotStore == undefined ? true : opts.doNotStore;
    const validate = opts.validate == undefined ? true : opts.validate;
    const processText = str => {
      const ret = stripHTML ? striptags(str) : str;
      if (validate && !ret) {
        throw new TextEmptyError();
      }
      if (validate && !truncate && ret.length > MAX_LENGTH) {
        throw new TextTooLongError();
      }
      return truncate ? ret.substr(0, MAX_LENGTH) : ret;
    };
    let resource = {};
    if (typeof text === 'object') {
      resource = text;
      if (stripHTML && resource.comment.text) {
        resource.comment.text = processText(resource.comment.text);
      }
    } else {
      resource.comment = {text: processText(text)};
    }
    let attributes =
      opts.attributes == undefined && !resource.requestedAttributes
        ? {TOXICITY: {}}
        : opts.attributes;
    if (Array.isArray(opts.attributes)) {
      attributes = {};
      opts.attributes.forEach(each => {
        attributes[each.toUpperCase()] = {};
      });
    }
    return merge(resource, {
      requestedAttributes: attributes,
      doNotStore,
    });
  }
}

Perspective.PerspectiveAPIClientError = PerspectiveAPIClientError;
Perspective.TextEmptyError = TextEmptyError;
Perspective.TextTooLongError = TextTooLongError;
Perspective.ResponseError = ResponseError;
Perspective.DEFAULT_HOST = DEFAULT_HOST;
module.exports = Perspective;
