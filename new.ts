// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 * v0.0.2
 *
 * Nano template engine – a very simple semi logic-less template engine.
 * This was initially made for playing around with simple prototypes deployed
 * with Deno Deploy, which currently doesn't play very well with template
 * engines that rely on evaluating expressions at runtime. Nano doesn't support
 * expressions either (yet) but will work with all the basics like loops,
 * filters, imports, and simple if statements. Nano inherits its syntax from
 * the most commonly known template engines like Django, Jinja, Twig, etc.
 *
 */

/**
 *
 * TOKEN TYPES
 *
 * value_raw					<div>hello</div>
 * value_literal				"quoted"
 * value_variable				variable.dot.separated
 * value_filter				variable | filter_name
 * value_truthy				value
 * value_truthy_negated		not value
 * expression_ternary		variable ? 'value_if_true' : 'value_if_false'
 * expression_logical		variable and
 * tag_escaped					{{{ variable_escaped }}}
 * tag_literal					{{ variable }}
 * block_for					{% for num, index in numbers | unique %}
 * block_if						{% if variable_1 and not variable_3 %}
 * block_else					{% else %}
 * block_include				{% include 'path/to/file.html' %}
 * block_comment				{# commented #}
 *
 **/

/**
 *
 * {
 * 	type: 'block_if',
 * 	value: [
 * 		{
 * 			type: 'expression_logical',
 * 			left: {
 *
 * 			}
 * 		}
 * 	]
 * }
 *
 *
 **/

/**
 *
 * 1. the lexer that splits the string input into lexemes
 *
 **/

function analyze(input: string): Tokens {
	/**
	 *
	 * possible leximes match types:
	 * HTML, TAG, TAG_ESCAPED, BLOCK, COMMENT
	 *
	 **/
	const lexeme_types = ['HTML', 'TAG', 'TAG_ESCAPED', 'BLOCK', 'COMMENT'];
	const lexemes: string[] = input.split(/({{.*?}})|({{{.*?}}})|({%.*?%})|({#.*?#})/g).filter(v => v);

	/**
	 *
	 * initial scan that goes through each lexeme and
	 * then returns an initial structure to tokenize.
	 * the most important part here is grouping blocks.
	 * this is there you throw missing end tag errors
	 *
	 * {% for a in aa %}
	 * 	{% for b in bb %}
	 * 		{{ test }}
	 * 	{% endfor %}
	 * {% endfor %}
	 *
	 * {
	 * 	type: 'BLOCK',
	 * 	match: for a in aa,
	 * 	value: {
	 *			type: 'BLOCK',
	 * 		match: for b in bb,
	 * 		value: {
	 *				type: 'TAG',
	 * 			match: 'test'
	 * 		}
	 * 	}
	 * }
	 *
	 **/
	function traverse() {
		const block_stack = [];
	}
}

/* interpreter function that renders tokens in relation to the data object */
function render(tokens, data) {}
