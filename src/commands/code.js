'use strict';

const { code } = require('../search');

async function search(query, languages = null) {
  await code(query, languages, line => console.log(line));
}

module.exports = {
  search
};
