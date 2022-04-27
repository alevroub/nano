import { scan, parse, compile } from './mod.ts'

const TEST_DATA = {
	yo: 'yo_from_data',
	ye: { dot: { separated: 99999 } },
	aa: ['a', 'b', 'c'],
	bb: ['uno', 'dos']
}

const TEST_INPUT = [
	'{% if a   %}',
	'"AAA"',
	'{{ eee }}',
	'"AAA"',
	'{% else %}',
	'{{ BBB }}',
	'{% endif %}',
].join('')


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
	// console.log(scan(TEST_INPUT));
	console.log(parse(scan(TEST_INPUT), TEST_DATA));
	// console.log(JSON.stringify(parse(scan(TEST_INPUT)), null, 2))
} catch(error) {
	console.log('%c' + error.message, 'color: red')
}