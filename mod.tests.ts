import { render } from './mod.ts';

const tests = [
	[`{{ undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ not undefined_variable ? "a" : "b" }}`, `a`],
	[`{{ not not undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ things | first is "alpha" ? "a" : "b" }}`, `a`],
	[`{{ things | first is not "alpha" ? "a" : "b" }}`, `b`],
	[`{{ things ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ things or undefined_variable ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ not things or undefined_variable ? "a" | repeat : "b" }}`, `b`],

	[`{{ nested.thing }}`, `100`],
	[`{{ nested["thing"] }}`, `100`],
	[`{{ nested["thing"] | type }}`, `string`],
	[`{{ missing | type }}`, `undefined`],
	[`{{ "i am a string" | type }}`, `string`],
	[`{{ 200 | type }}`, `number`],
	[`{{ 20.5 | type }}`, `number`],
	[`{{ true | type }}`, `boolean`],
	[`{{ false | type }}`, `boolean`],
	[`{{ true ? 'yes' : 'no' }}`, `yes`],
	[`{{ not true ? 'yes' : 'no' }}`, `no`],
	[`{{ false ? 'yes' : 'no' }}`, `no`],
	[`{{ not false ? 'yes' : 'no' }}`, `yes`],
	[`{{ -10 | minus ? 'yes' : 'no' }}`, `yes`],
];

const data = {
	things: ['alpha', 'beta'],
	nested: {
		thing: "100"
	}
};

const methods = {
	lower: v => v.toLowerCase(),
	first: v => v[0],
	repeat: v => v.repeat(5),
	type: v => typeof v,
	minus: v => v === -10
};

for (let t = 0; t < tests.length; t += 1) {
	const [input, output] = tests[t];
	const result = await render(input, data, methods);
	const pass = result === output;

	console.log(`%c[${t + 1}/${tests.length}] ${ result } / ${ output }`, `color:${pass ? 'green' : 'red'}`);
}
