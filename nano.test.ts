import { scan, parse, compile, render } from './mod.ts';

const TEST_METHODS = {
	upper: (value: any) => value.toString().toUpperCase(),
	more_than_three: (value: any) => value > 3,
};

const TEST_DATA = {
	'000_technically_invalid': 'lol',
	string: 'hello_from_data',
	number: 200,
	an_array: ['banana', 'apple', 'pear'],
	an_object: { a: 'banana', b: 'apple', c: 'pear' },
};

const TEST_INPUT = `
	<div>Hei</div>
	<div>{{ number }}</div>
	<div>{{ an_object.a }}</div>
	<div>{{ "Literally this string" }}</div>
	{% for key, value in an_object %}
		<section>
			<div>{{ key }}: {{ value }}</div>
		</section>
	{% endfor %}

	{% if number %}
		<div>{{ number}}</div>
	{% endif %}

	{% for item in an_array %}
		<div>{{ item }}</div>
	{% endfor %}
`;

try {
	console.time('RENDER');

	// const scanned = scan(TEST_INPUT);
	// const parsed = parse(scanned);
	// const compiled = await compile(parsed, TEST_DATA, TEST_METHODS);
	const rendered = await render(TEST_INPUT, TEST_DATA, TEST_METHODS);

	console.log(rendered);
	console.timeEnd('RENDER');
} catch (error) {
	console.log('%c' + error.message, 'color: red');
}
