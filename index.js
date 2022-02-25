#!/usr/bin/env node
'use strict';

import fs from 'fs';
import util from 'util';
import { join } from 'path';
import minimist from 'minimist';
import glob from 'glob';
import glob2base from 'glob2base';
import nunjucks from 'nunjucks';
import chalk from 'chalk';

const argv = minimist(process.argv.slice(2), {
  string: ['dir', 'context'],
  boolean: [],
  alias: {
    dir: 'd',
    context: 'c'
  },
  default: {
    dir: '.'
  }
});

const pattern = argv._[0];
const base = glob2base(glob(pattern));
const context = {
  _data: null,
  _assign: {
    env: process.env.NODE_ENV || 'development'
  },
  get data() {
    if (!this._data) this.data = argv.context;
    return this._data;
  },
  set data(path) {
    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      this._data = Object.assign(data, this._assign);
    } catch (error) {
      console.error(chalk.red(error));
      this._data = this._assign;
    }
  }
};

nunjucks.configure(base, { noCache: true });
const renderSync = util.promisify(nunjucks.render);

console.log(context.data);


process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.bgRed(reason, promise));
});
