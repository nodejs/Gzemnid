module.exports = function(stream) {
  stream.on('data', ({ key, value }) => {
    const [path, ast] = [key, value];
    const status = typeof ast === 'string' ? ast : 'ok';
    console.log(`[${status}] ${path}`);
  });
  return stream.promise;
};
