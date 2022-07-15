import { render } from './mod.ts';

const input = `
	{{ import "folder/test.import.html" with { nested_var: array_like } }}
`;

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

const result = await render(input, data, methods);

console.log([result])