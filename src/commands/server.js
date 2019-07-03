'use strict';

const Koa = require('koa');
const logger = require('koa-logger');
const route = require('koa-route');
const stream = require('stream');
const config = require('../config').config;
const search = require('../search');

async function run() {
  const api = new Koa();

  api.use(logger());

  api.use(async(ctx, next) => {
    ctx.res.on('close', () => {
      ctx.state.closed = true;
    });

    ctx.type = 'text/plain; charset=utf-8';
    ctx.set('Content-Security-Policy', 'default-src \'self\'');

    if (ctx.request.url.startsWith('/api/')) {
      const token = ctx.query.token;
      if (!token || !config.api.tokens.hasOwnProperty(token)) {
        ctx.throw(403);
      }
    }

    await next();
  });

  api.use(route.get('/api/queue/size', async ctx => {
    ctx.type = 'text/plain; charset=utf-8';
    ctx.body = search.queue.size;
  }));

  api.use(route.get('/api/search/code', async ctx => {
    ctx.type = 'text/plain; charset=utf-8';
    ctx.set('Gzemnid-Queue-Size', search.queue.size);
    ctx.status = 200;
    ctx.body = new stream.PassThrough();

    ctx.res.on('close', () => {
      // TODO: handle early close
    });

    setImmediate(async() => {
      ctx.res.flushHeaders();
      await search.code(ctx.query.query, null, line =>
        ctx.body.write(`${line}\n`)
      );
      ctx.body.end();
    });
  }));

  api.listen(config.api.port);
}

module.exports = {
  run
};
