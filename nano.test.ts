import { scan, parse, compile } from './mod.ts'

const TEST_DATA = {
	yo: 'yo_from_data',
	ye: { dot: { separated: 99999 } },
	aa: ['a', 'b', 'c'],
	bb: ['uno', 'dos']
}

const TEST_INPUT = `
	<div>Hei</div>
	<div>{{ yo }}</div>
	{#
		just a comment
	#}
	<div>{{ ye.dot.separated }}</div>

	{% if non_existent %}
		<div>IF</div>
	{% else %}
		<div>ELSE</div>
	{% endif %}

	{% for a in AA %}
		{% for b in BB %}
			<div>{{ inside_b }}</div>
		{% endfor %}
	{% endfor %}`

try {
	// console.log(JSON.stringify(scan(TEST_INPUT), null, 2))
	// console.log(scan(TEST_INPUT));
	console.log(parse(scan(TEST_INPUT), TEST_DATA));
} catch(error) {
	console.log('%c' + error.message, 'color: red')
}