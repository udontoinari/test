#!/usr/bin/env node
'use strict';

import fs from 'fs';
import util from 'util';
import { basename, dirname, join, relative } from 'path';
import minimist from 'minimist';
import glob from 'glob';
import glob2base from 'glob2base';
import nunjucks from 'nunjucks';
import beautify from 'js-beautify';
import chokidar from 'chokidar';
import chalk from 'chalk';

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
  set data(path) {
    try {
      this._data = JSON.parse(fs.readFileSync(path));
    } catch (error) {
      console.error(chalk.red(error));
      this._data = {};
    }
    this._data.env = process.env.NODE_ENV || 'development';
  }
};

nunjucks.configure(base, { noCache: true });
const renderSync = util.promisify(nunjucks.render);
const rc = join(process.cwd(), '.jsbeautifyrc');
const options = fs.existsSync(rc) ? JSON.parse(fs.readFileSync(rc)) : {};

const render = async (path) => {
  const paths = path ? [path] : glob.sync(pattern, {
    ignore: '**/_*.*'
  });
  for (const path of paths) {
    const input = relative(base, path);
    const string = await renderSync(input, context.data).catch(error => {
      console.error(chalk.red(error));
    });
    if (!string) continue;

    const output = join(argv.dir, input.replace(/\.\w+$/, '.html'));
    fs.mkdirSync(dirname(output), { recursive: true });
    fs.writeFileSync(output, beautify.html(string, options));
    console.log(chalk.blue(`Rendered: ${output}`));
  }
};

if (argv.watch) {
  const options = {
    ignoreInitial: true
  };
  const watcher = chokidar.watch(pattern, options);
  watcher.on('ready', () => {
    console.log(chalk.gray('Watching templates. Press Ctrl-C to stop.'));
  });
  watcher.on('all', (eventName, path) => {
    if (eventName == 'unlink') return;
    render(basename(path).indexOf('_') == 0 ? null : path);
  });
  chokidar.watch(argv.context, options).on('all', () => {
    context.data = argv.context;
    render();
  });
} else {
  render();
}
