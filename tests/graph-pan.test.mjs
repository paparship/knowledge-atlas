import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('中键平移相机，不旋转、不修改节点、不触发选择；左键仍可旋转', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const canvas = { style: {}, setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, addEventListener() {} };
  const camera = { yaw: .2, pitch: -.15, zoom: 1 };
  const positions = { node: [1, 2, 3] };
  let selections = 0, prevented = 0;
  const context = vm.createContext({ canvas, camera, positions, point: e => ({ x: e.x, y: e.y }), hit: () => ({ node: { id: 'node' }, scale: 1 }), selectNode: () => selections++, hitEdges: [], layoutDirty: false });
  vm.runInContext(source.slice(source.indexOf('let drag=null;'), source.indexOf("canvas.addEventListener('wheel'")), context);
  const event = (button, x, y) => ({ button, x, y, pointerId: 1, shiftKey: true, preventDefault: () => prevented++ });
  canvas.onpointerdown(event(1, 10, 20));
  canvas.onpointermove(event(1, 90, 65));
  canvas.onpointerup(event(1, 90, 65));
  assert.equal(camera.panX, 80); assert.equal(camera.panY, 45);
  assert.equal(camera.yaw, .2); assert.equal(camera.pitch, -.15);
  assert.deepEqual(positions.node, [1, 2, 3]); assert.equal(selections, 0); assert.equal(prevented, 1);
  canvas.onpointerdown({ ...event(0, 10, 20), shiftKey: false });
  canvas.onpointermove(event(0, 30, 20));
  canvas.onpointerup(event(0, 30, 20));
  assert.equal(camera.yaw, .32); assert.equal(camera.panX, 80);
});
