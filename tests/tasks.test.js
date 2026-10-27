import test from 'node:test';
import assert from 'node:assert/strict';
import { taskTitle, taskOrder } from '../src/tasks.js';
test('blank tasks and long tasks are rejected, whitespace is trimmed', () => {
  assert.throws(() => taskTitle('  \n '), /Enter a task/);
  assert.throws(() => taskTitle('x'.repeat(301)), /300/);
  assert.equal(taskTitle('  Buy groceries  '), 'Buy groceries');
});
test('unfinished tasks stay first, with stable order, without changing input', () => {
  const data=[{id:'b',completed:true,created_at:'2026-10-14'},{id:'c',completed:false,created_at:'2026-10-15'},{id:'a',completed:false,created_at:'2026-10-14'}];
  assert.deepEqual(taskOrder(data).map(t=>t.id),['a','c','b']);
  assert.deepEqual(data.map(t=>t.id),['b','c','a']);
});
