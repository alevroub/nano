import { scan, parse, compile, render } from './mod.ts';

const TEST_METHODS = {
	what: (v: any) => typeof v
};

const TEST_DATA = {
	things: { a: 'banana', b: 'apple', c: 'pear' },
	A: false,
	C: true
};

const TEST_INPUT = [
	'{% if A %}',
		'{% if AA %}',
			'{% for n in NN %}',
				'NNN',
			'{% endfor %}',
		'{% else %}',
			'{% if AAA %}',
				'AAA',
			'{% else %}',
				'AB',
			'{% endif %}',
		'{% endif %}',
	'{% else %}',
		'{% if B %}',
			'B',
		'{% else %}',
			'{% if C %}',
				'C',
			'{% else %}',
				'NOT C',
			'{% endif %}',
		'{% endif %}',
	'{% endif %}',
].join('');


const TEST_INPUT_B = [
	'{% if A %}',
		'{% if AA %}',
			'{% for n in NN %}',
				'NNN',
			'{% endfor %}',
		'{% elseif AAA %}',
			'AAA',
		'{% else %}',
			'AB',
		'{% endif %}',
	'{% elseif B %}',
		'B',
	'{% elseif C %}',
		'C',
	'{% else %}',
		'NOT C',
	'{% endif %}',
].join('');

try {
	console.time('RENDER');

	const a = JSON.stringify(scan(TEST_INPUT), null, 3);
	const b = JSON.stringify(scan(TEST_INPUT_B), null, 3);

	console.log(a === b);

	console.log(await render(TEST_INPUT, TEST_DATA, TEST_METHODS));
	console.log(await render(TEST_INPUT_B, TEST_DATA, TEST_METHODS));
	// console.log(await compile(TEST_INPUT));
	console.timeEnd('RENDER');
} catch (error) {
	console.log('%c' + error.message, 'color: red');
}
