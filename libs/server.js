'use strict';

const Koa = require('koa');
const logger = require('koa-logger');
const route = require('koa-route');
const stream = require('stream');
const config = require('./config').config;
const search = require('./search');

async function run() {
  const api = new Koa();

  api.use(logger());

  api.use(async (ctx, next) => {
    ctx.res.on('close', () => {
      ctx.state.closed = true;
    });

    ctx.type = 'text/plain; charset=utf-8';
    ctx.set('Content-Security-Policy', 'default-src \'self\'');

    if (ctx.request.url.startsWith('/api/')) {
      if (!ctx.query.token || !config.api.tokens[ctx.query.token]) {
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

    let child;
    ctx.res.on('close', () => {
      if (child) child.kill('SIGKILL');
    });

    setImmediate(async () => {
      ctx.res.flushHeaders();
      child = await search.code(ctx.query.query);
      child.on('exit', () => {
        child = undefined;
      });
      if (ctx.state.closed) child.kill('SIGKILL');
      child.stdout.pipe(ctx.body);
    });
  }));

  api.listen(config.api.port);
}

module.exports = {
  run
};
