import { render } from './mod.ts';

const tests = [
	[`{{ nested.not.defined }}`, ``],
	[`{{ "confusing ? : string ? " | length > 1 ? "a" : "b ? a: a" }}`, `a`],
	[`{{ undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ !undefined_variable ? "a" : "b" }}`, `a`],
	[`{{ !undefined_variable && number == 100 ? "a" : "b" }}`, `a`],
	[`{{ array_like | first == "alpha" ? "a" : "b" }}`, `a`],
	[`{{ array_like | first | lower == "alpha" ? "a" : "b" }}`, `a`],
	[`{{ array_like | first != "alpha" ? "a" : "b" }}`, `b`],
	[`{{ array_like ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ array_like || undefined_variable ? "a" | repeat : "b" }}`, `aaaaa`],
	[`{{ !array_like || undefined_variable ? "a" | repeat : "b" }}`, `b`],
	[`{{ object_like | keys | first == "a" ? 'yes' : 'no' }}`, `yes`],
	[`{{ number == 100 ? "n == 100" | upper : 'no' }}`, `N == 100`],
	[`{{ nested.thing }}`, `100`],
	[`{{ nested.thing == "100" || nested.thing == "200" }}`, `true`],
	[`{{ nested["thing"] }}`, `100`],
	[`{{ nested["thing"] | type }}`, `string`],
	[`{{ missing | type }}`, `undefined`],
	[`{{ "i am a string" | type }}`, `string`],
	[`{{ 200 | type }}`, `number`],
	[`{{ 20.5 | type }}`, `number`],
	[`{{ true | type }}`, `boolean`],
	[`{{ false | type }}`, `boolean`],
	[`{{ true ? 'yes' : 'no' }}`, `yes`],
	[`{{ !true ? 'yes' : 'no' }}`, `no`],
	[`{{ false ? 'yes' : 'no' }}`, `no`],
	[`{{ !false ? 10 : 20 }}`, `10`],
	[`{{ -10 | minus ? 'yes' | upper : 'no' }}`, `YES`],
	[`{% for n in array_like %}{{ n }}__{% endfor %}`, `alpha__beta__`],
	[`{% for n, i in array_like %}{{ i }}:{{ n }}{% endfor %}`, `0:alpha1:beta`],
	[`{% for n in object_like %}{{ n }}{% endfor %}`, `alphabeta`],
	[`{% for k, v in object_like %}{{ k }}:{{ v }}{% endfor %}`, `a:alphab:beta`],
	[`{% for n in object_like | keys %}{{ n | upper }}{% endfor %}`, `AB`],
];

const tests_ = [
	[`{{ undefined_variable ? "a" : "b" }}`, `b`],
	[`{{ not undefined_variable ? "a" : "b" }}`, `a`],
	[`{{ not not undefined_variable ? "a" : "b" }}`, `b`],
];

const data = {
	number: 100,
	nested: { thing: '100' },
	array_like: ['alpha', 'beta'],
	object_like: { a: 'alpha', b: 'beta' },
};

const methods = {
	upper: v => v.toUpperCase(),
	lower: v => v.toLowerCase(),
	first: v => v[0],
	repeat: v => v.repeat(5),
	minus: v => v === -10,
	length: v => v.length,
	keys: v => Object.keys(v),
	type: v => typeof v,
};

for (let t = 0; t < tests.length; t += 1) {
	const [input, output] = tests[t];
	const count = `${(t + 1).toString().padStart(2, '0')}/${tests.length}`;

	try {
		const result = await render(input, data, methods);
		const pass = result === output;

		console.log(`%c[${count} ${pass ? 'PASS' : 'FAIL'}] ${input}`, `color:${pass ? 'green' : 'red'}`);
	} catch(error) {
		console.log(`%c[${count} FAIL] ${input}`, `color:red`);
		console.log(`>>> ${error.message}`)
	}
}