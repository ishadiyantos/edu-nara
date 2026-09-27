import {expect,test} from 'vitest';
import config from '../../svelte.config.js';
test('CSP blocks foreign scripts and framing',()=>{
 expect(config.kit).toMatchObject({csp:{directives:{'script-src':['self'],'frame-ancestors':['none']}}});
});
