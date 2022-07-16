import { parse, scan, render } from './mod.ts';

const input = `
	{{ boolean == true ? "YES" : "NO" }}
`;

const data = {
	boolean: true,
	number: 100,
	string: "bbb",
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

// const result = await parse(scan(input));
const result = await render(input, data, methods, { show_comments: true });

console.log(JSON.stringify(result, null, 3))