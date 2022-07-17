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
	upper: (v: any) => v.toUpperCase(),
	lower: (v: any) => v.toLowerCase(),
	first: (v: any) => v[0],
	repeat: (v: any) => v.repeat(5),
	minus: (v: any) => v === -10,
	keys: (v: any) => Object.keys(v),
	type: (v: any) => typeof v,
};

// const result = await parse(scan(input));
const result = await render(input, data, methods);

console.log(JSON.stringify(result, null, 3))