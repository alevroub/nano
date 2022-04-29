import { scan, parse, compile } from './mod.ts';

const TEST_METHODS = {
	upper: value => value.toString().toUpperCase(),
	json: value => JSON.stringify(value, null, 3),
};

const TEST_DATA = {
	test: 'hello_from_data',
	// fruits: ['banana', 'apple', 'pear']
	fruits: { a: 'banana', b: 'apple', c: 'pear' },
};

const TEST_INPUT = `
	{{ import 'index.html' }}
	<div>test</div>
`;

// const TEST_INPUT = [
// 	'<div>Hei</div>',
// 	'<div>{{ 100 }}</div>',
// 	'<div>{{ "Literally" }}</div>',
// 	'{#',
// 		'just a comment',
// 	'#}',
// 	'<div>{{ dot.separated }}</div>',

// 	'{% if non_existent %}',
// 		'<div>IF</div>',
// 	'{% else %}',
// 		'<div>ELSE</div>',
// 	'{% endif %}',

// 	'{% for a in AA %}',
// 		'{% for b in BB %}',
// 			'<div>{{ inside_b }}</div>',
// 		'{% endfor %}',
// 	'{% endfor %}',
// ].join('')

try {
	console.time('RENDER');

	const scanned = scan(TEST_INPUT);
	const parsed = parse(scanned);
	const compiled = await compile(parsed, TEST_DATA, TEST_METHODS);

	console.log(compiled);
	console.timeEnd('RENDER');
} catch (error) {
	console.log('%c' + error.message, 'color: red');
}
