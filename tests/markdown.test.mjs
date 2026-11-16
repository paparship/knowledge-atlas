import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Markdown renders Windows and Unix line endings identically', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({ inline: text => text, codeBlock: text => `<pre>${text}</pre>` });
  vm.runInContext(source.slice(source.indexOf('function markdown('), source.indexOf('function renderBlocks(')), context);
  const input = '## 1. 任务\n\n正文\n\n---\n\n| 目标 | 次数 |\n| --- | --- |\n| 花 | 3 |\n\n```json\n{}\n```';
  const expected = context.markdown(input);
  assert.match(expected, /<h2>1\. 任务<\/h2>/);
  assert.match(expected, /<hr>/);
  assert.equal(context.markdown(input.replaceAll('\n', '\r\n')), expected);
  assert.equal(context.markdown(input.replaceAll('\n', '\r')), expected);
});
