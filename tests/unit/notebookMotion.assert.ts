import assert from 'node:assert/strict';
import { floatingMenuMotionStyle } from '../../src/components/ui/floating-menu-motion';

const notebook = { notebook: true };
assert.equal(floatingMenuMotionStyle('open', 'bottom-start', 'full', notebook).transitionDuration, '360ms');
assert.equal(floatingMenuMotionStyle('close', 'bottom-start', 'full', notebook).transitionDuration, '220ms');
assert.equal(floatingMenuMotionStyle('close', 'top-start', 'full', notebook).transform, 'translateY(4px) scale(.985)');
assert.equal(floatingMenuMotionStyle('close', 'bottom-start', 'reduced', notebook).transform, 'none');
assert.equal(floatingMenuMotionStyle('initial', 'bottom-start', 'instant', notebook).opacity, 1);
assert.equal(floatingMenuMotionStyle('open', 'bottom-start', 'full').transitionDuration, '200ms');
assert.equal(floatingMenuMotionStyle('close', 'bottom-start', 'full').transitionDuration, '150ms');
