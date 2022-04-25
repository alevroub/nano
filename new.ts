// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 * v0.0.1
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
 *	1. analyze
 * 	input -> lexemes -> tokens
 *
 * 	TOKEN TYPES
 * 		0 - VARIABLE 		{{ variable }}
 * 		1 - COMMENT 		{# comment #}
 * 		2 - BLOCK 			{% if/else/for %}
 * 		3 - TEXT				<div>text</div>
 *
 * 2. parse
 * 	tokens -> nodes
 *
 * 	NODE TYPES
 * 		value_raw					<div>hello</div>
 * 		value_literal				"quoted"
 * 		value_variable				variable.dot.separated
 * 		value_filter				variable | filter_name
 * 		value_truthy				value
 * 		value_truthy_negated		not value
 * 		expression_ternary		variable ? 'value_if_true' : 'value_if_false'
 * 		expression_logical		variable and
 * 		tag_escaped					{{{ variable_escaped }}}
 * 		tag_literal					{{ variable }}
 * 		block_for					{% for num, index in numbers | unique %}
 * 		block_if						{% if variable_1 and not variable_3 %}
 * 		block_else					{% else %}
 * 		block_include				{@ 'path/to/file.html' @}
 * 		block_comment				{# commented #}
 *
 * 3. render (interpreter)
 * 	nodes -> output
 *
 **/

/**
 *
 * 1. lexer that splits the string input into lexemes and returns
 * 	tokens. the goal in this step is to make sure the *structure* of
 * 	all blocks are valid, e.g. check for missing or duplicate tags.
 * 	invalid block statements or syntax errors are checked in the next
 * 	step when the tokens are used to create nodes.
 *
 **/
function analyze(input: string): Tokens {
	const RE_VARIABLE = /{{.*?}}/;
	const RE_COMMENT = /{#.*?#}/;
	const RE_BLOCK = /{%.*?%}/;
	const RE_ALL = /({{.*?}}|{#.*?#}|{%.*?%})/;

	const TOKEN_TYPES = [
		'variable',
		'comment',
		'block',
		'text'
	];

	class Token {
		constructor(type, value) {
			this.type = type;
			this.value = value;

			if (type === 2) {
				this.tokens = [];
			}
		}
	}

	const tokens = [];
	const block_stack = [];
	const lexemes = input.split(RE_ALL);

	for (const lexeme of lexemes) {
		const matches_block = RE_BLOCK.test(lexeme);
		const token_type = return_token_type(lexeme);

		if (token_type === 2) {
			const statement = lexeme.slice(2, -2).trim();

			if (statement.startsWith('end')) {
				const end_statement_type = statement.slice(3); //endif -> if
				let last_token = block_stack.pop();

				if (last_token.value === 'else') {
					/**
					 * first push this token to the stack and pop the next one
					 * which will have to be an if statement, otherwise a
					 * statement mismatch will occur throwing a syntax error
					 **/

					output_token(last_token);
					last_token = block_stack.pop();
				}

				if (!last_token) {
					throw new Error('Syntax error: too many closing tags');
				}

				if (!last_token.value.startsWith(end_statement_type)) {
					throw new Error('Syntax error: invalid closing tag');
				}

				output_token(last_token);
			} else {
				block_stack.push(new Token(token_type, statement));
			}
		} else {
			output_token(new Token(token_type, lexeme));
		}
	}

	if (block_stack.length > 0) {
		throw new Error('Syntax error: missing closing tag');
	}

	function output_token(token) {
		if (block_stack.length > 0) {
			block_stack[block_stack.length - 1].tokens.push(token);
		} else {
			tokens.push(token);
		}
	}

	function return_token_type(lexeme) {
		if (RE_VARIABLE.test(lexeme)) {
			return 0;
		} else if (RE_COMMENT.test(lexeme)) {
			return 1;
		} else if (RE_BLOCK.test(lexeme)) {
			return 2;
		} else {
			return 3;
		}
	}

	return tokens;
}

/**
 *
 * 2.	parser that takes the initial tree of tokens and builds a tree of
 * 	nodes with more information about each token match. this step takes
 * 	care of syntax formatting and should provide all relevant properties
 * 	to the renderer.
 *
 **/

function parse() {

}

const TEST_INPUT = `
	<div>Hei</div>
	<div>{{ yo }}</div>
	<div>Hei</div>

	{% if %}
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
	console.log(JSON.stringify(analyze(TEST_INPUT), null, 2))
} catch(error) {
	console.log('%c' + error.message, 'color: red')
}

/* interpreter that renders tokens in relation to the data object */
function render(tokens, data) {}
