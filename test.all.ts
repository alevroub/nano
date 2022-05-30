import { render } from './mod.ts';

const tests = [
	[`{{ undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ not undefined_variable ? "a" : "b" }}`, `a`],
	[`{{ not not undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ array_like | first is "alpha" ? "a" : "b" }}`, `a`],
	[`{{ array_like | first is not "alpha" ? "a" : "b" }}`, `b`],
	[`{{ array_like ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ array_like or undefined_variable ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ not array_like or undefined_variable ? "a" | repeat : "b" }}`, `b`],
	[`{{ object_like | keys | first is "a" ? 'yes' : 'no' }}`, `yes`],
	[`{{ number is 100 ? "n is 100" | upper : 'no' }}`, `N IS 100`],
	[`{{ nested.thing }}`, `100`],
	[`{{ nested.thing is "100" or nested.thing is "200" }}`, `true`],
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
	[`{{ not false ? 10 : 20 }}`, `10`],
	[`{{ -10 | minus ? 'yes' | upper : 'no' }}`, `YES`],
	[`{% for n in array_like %}{{ n }}__{% endfor %}`, `alpha__beta__`],
	[`{% for n, i in array_like %}{{ i }}:{{ n }}{% endfor %}`, `0:alpha1:beta`],
	[`{% for n in object_like %}{{ n }}{% endfor %}`, `alphabeta`],
	[`{% for k, v in object_like %}{{ k }}:{{ v }}{% endfor %}`, `a:alphab:beta`],
	[`{% for n in object_like | keys %}{{ n | upper }}{% endfor %}`, `AB`],
];

const data = {
	number: 100,
	nested: { thing: "100" },
	array_like: ['alpha', 'beta'],
	object_like: { a: 'alpha', b: 'beta' },
};

const methods = {
	upper: v => v.toUpperCase(),
	lower: v => v.toLowerCase(),
	first: v => v[0],
	repeat: v => v.repeat(5),
	minus: v => v === -10,
	keys: v => Object.keys(v),
	type: v => typeof v,
};

for (let t = 0; t < tests.length; t += 1) {
	const [input, output] = tests[t];
	const result = await render(input, data, methods);
	const pass = result === output;

	console.log(`%c[${(t + 1).toString().padStart(2, '0')}/${tests.length}] ${ result } / ${ output }`, `color:${pass ? 'green' : 'red'}`);
}
