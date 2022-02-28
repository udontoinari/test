#!/usr/bin/env node
'use strict';

import beautify from 'js-beautify';
import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import glob2base from 'glob2base';
import minimist from 'minimist';
import nunjucks from 'nunjucks';
import path from 'path';
import util from 'util';

const argv = minimist(process.argv.slice(2), {
  string: ['dir', 'context'],
  boolean: ['watch'],
  alias: {
    d: 'dir',
    c: 'context',
    w: 'watch'
  },
  default: {}
});

const pattern = argv._[0];
const base = glob2base(glob(pattern));
argv.dir = argv.dir || base;

const context = {
  _data: null,
  get data() {
    if (!this._data) this.data = argv.context;
    return this._data;
  },
  set data(file) {
    try {
      this._data = JSON.parse(fs.readFileSync(file));
    } catch (error) {
      console.error(chalk.red(error));
      this._data = {};
    }
    this._data.env = process.env.NODE_ENV || 'development';
  }
};

nunjucks.configure(base, { noCache: true });
const renderSync = util.promisify(nunjucks.render);
const rc = path.join(process.cwd(), '.jsbeautifyrc');
const options = fs.existsSync(rc) ? JSON.parse(fs.readFileSync(rc)) : {};

const render = async (file) => {
  const files = file ? [file] : glob.sync(pattern, {
    ignore: '**/_*.*'
  });
  for (const file of files) {
    const input = path.relative(base, file);
    const string = await renderSync(input, context.data).catch(error => {
      console.error(chalk.red(error));
    });
    if (!string) continue;

    const output = path.join(argv.dir, input.replace(/\.\w+$/, '.html'));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, beautify.html(string, options));
    console.log(chalk.blue(`Rendered: ${output}`));
  }
};

if (argv.watch) {
  const options = {
    ignoreInitial: true
  };
  chokidar.watch(pattern, options).on('all', (eventName, file) => {
    if (eventName == 'unlink') return;
    render(path.basename(file).indexOf('_') == 0 ? null : file);
  });
  chokidar.watch(argv.context, options).on('all', () => {
    context.data = argv.context;
    render();
  });
} else {
  render();
}
