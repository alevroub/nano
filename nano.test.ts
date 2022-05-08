import { scan, parse, compile, render } from './mod.ts';

const TEST_METHODS = {
	what: (v: any) => typeof v
};

const TEST_DATA = {
	an_object: { a: 'banana', b: 'apple', c: 'pear' },
};

const TEST_INPUT = `
	{% if not_here %}
		IF
	{% else %}
		{{ not_here | what }}
		ELSE
	{% endif %}
`;

try {
	console.time('RENDER');
	console.log(await render(TEST_INPUT, TEST_DATA, TEST_METHODS));
	console.timeEnd('RENDER');
} catch (error) {
	console.log('%c' + error.message, 'color: red');
}
