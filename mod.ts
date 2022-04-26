// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 *
 * 	>> SOON
 * 		[ ] {@ include @}
 * 		[ ] use/support function(syntax) for filters
 * 		[ ] basic expressions: && || == != >, >=, <, <=
 *
 * */

/**
 * v0.0.1
 *
 * Nano template engine – a very simple (semi) logic-less template engine.
 * This was initially made for playing around with simple prototypes deployed
 * with Deno Deploy, which currently doesn't play very well with template
 * engines that rely on evaluating expressions at runtime. Nano doesn't support
 * expressions either (yet) but does work with all the basics like loops,
 * filters, imports, and simple if statements. Nano inherits its syntax from
 * the most commonly known template engines like Django, Jinja, Twig, etc.
 *
 */

/**
 *
 *	1. SCAN
 * 	input -> lexemes -> tokens
 *
 * 	lexer that splits the string input into lexemes and returns
 * 	tokens. the goal in this step is to make sure the structure of
 * 	all blocks are valid, e.g. check for missing or duplicate tags.
 * 	invalid block statements or syntax errors are checked in the next
 * 	step when the tokens are used to create nodes.
 *
 *		|	TOKEN TYPES
 *		|		0 - BLOCK   	{% if/else/for %}
 *		|		1 - VARIABLE	{{ variable }}
 *		|		2 - COMMENT 	{# comment #}
 *		|		3 - TEXT    	<div>text</div>
 *
 **/

class NanoError extends Error {
	public name = 'NanoSyntaxError';
}

type Token = {
	type: string;
	value: string;
	tokens?: Array<Token>;
};

type Node = {
	type: string;
	value: string;
	properties?: Record<string, any>;
};

const RE_BLOCK = /^{%.*?%}$/;
const RE_VARIABLE = /^{{.*?}}$/;
const RE_COMMENT = /^{#[^]*?#}$/;
const RE_ALL = /({%.*?%}|{{.*?}}|{#[^]*?#})/;

const TOKEN_TYPES = [
	'block',
	'tag',
	'comment',
	'text',
];

export function scan(input: string): Tokens {
	class Token {
		constructor(type, value) {
			this.type = type;
			this.value = value;

			if (type === TOKEN_TYPES[0]) {
				this.tokens = [];
			}
		}
	}

	const tokens = [];
	const block_stack = [];
	const lexemes = input.split(RE_ALL).filter(v => v);

	for (const lexeme of lexemes) {
		const token_type = return_token_type(lexeme);
		const token_content = token_type !== TOKEN_TYPES[3] ? lexeme.slice(2, -2).trim() : lexeme;

		if (token_type === TOKEN_TYPES[0]) {
			if (token_content.startsWith('end')) {
				const end_statement_type = token_content.slice(3); //endif -> if
				let last_token = block_stack.pop();

				if (last_token.value === 'else') {
					/**
					 * if-else exception: first push the else-token to the stack
					 * to keep its value and then skip to the next token (pop).
					 * the next token has to be an if statement, otherwise a
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
				block_stack.push(new Token(token_type, token_content));
			}
		} else {
			output_token(new Token(token_type, token_content));
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
		if (RE_BLOCK.test(lexeme)) {
			return TOKEN_TYPES[0];
		} else if (RE_VARIABLE.test(lexeme)) {
			return TOKEN_TYPES[1];
		} else if (RE_COMMENT.test(lexeme)) {
			return TOKEN_TYPES[2];
		} else {
			return TOKEN_TYPES[3];
		}
	}

	return tokens;
}

/**
 *
 * 2. PARSE
 * 	tokens -> nodes
 *
 * 	parser that takes the initial tree of tokens and builds a tree of
 * 	nodes with more information about each token match. this step takes
 * 	care of syntax formatting and should provide all relevant properties
 * 	to the renderer.
 *
 * 	|	NODE TYPES
 * 	|		[x] text                      		"hello"
 * 	|		[x] text_html                 		<div>hello</div>
 * 	|		[x] tag_variable              		variable.dot.separated | variable['named-key']
 * 	|		[x] tag_filter                		variable | filter_name
 * 	|		[x] tag_conditional           		variable ? 'value_if_true' : 'value_if_false'
 * 	|		[ ] block_for                 		{% for num, index in numbers | unique %}
 * 	|		[ ] block_if                  		{% if variable_1 %}
 * 	|		[ ] block_include             		{@ 'path/to/file.html' @}
 * 	|		[ ] block_comment             		{# commented #}
 * 	|		[ ] expression_logical_and    		and variable
 * 	|		[ ] expression_logical_or     		or variable
 * 	|		[ ] expression_binary         		is value
 * 	|		[ ] expression_binary_negated 		is not value
 *
 **/

export function parse(tokens) {
	const NODE_TYPES = [
		'text',
		'tag_variable',
		'tag_filter',
		'tag_conditional',
		'block_if',
		'block_for',
		'block_include',
		'block_comment',
	];

	const RE_SEPARATOR_FILTER = / ?\| ?/;
	const RE_SEPARATOR_DOT = /\./;
	const RE_SEPARATOR_TERNARY = /[?:]/;
	const RE_SEPARATOR_BRACES = /\[["']|['"]\]/;

	const RE_VARIABLE_EXPRESSION_LIKE = /[\&\|\<\>\+\-\=\!\{\}\,]/;
	const RE_VARIABLE_QUOTED = /^['"].+?['"]$/;
	const RE_VARIABLE_NAMED_KEY = /\[['"]/;
	const RE_VARIABLE_DIGIT = /^-?(\d|\.\d)+$/;
	const RE_VARIABLE_VALID = /^[^0-9][0-9a-zA-Z]*$/;
	const RE_METHOD_INVALID = /[\- ]/;

	class Node {
		constructor(type, value, properties) {
			this.type = type;
			this.value = value;

			if (properties) {
				this.properties = properties;
			}
		}
	}

	const nodes = [];

	function parse_tag(token) {
		// if (RE_VARIABLE_EXPRESSION_LIKE.test(token)) {
		// 	throw new NanoError('Variable expressions not allowed (yet)')
		// }

		if (token.value.includes('?')) {
			/* tag_conditional */

			const statement_parts = token.value.split(RE_SEPARATOR_TERNARY).map(v => v.trim());
			const statement_nodes = [];

			if (statement_parts.length !== 3) {
				throw new NanoError('Invalid ternary expression');
			}

			for (const part of statement_parts) {
				statement_nodes.push(return_tag_value(part))
			}

			return new Node(NODE_TYPES[3], statement_nodes);
		} else if (token.value.includes('|')) {
			/* tag_filter */

			const statement_parts = token.value.split(RE_SEPARATOR_FILTER).map(v => v.trim());
			const variable = statement_parts.shift();
			const filters = statement_parts.filter(v => v);

			if (filters.length === 0) {
				throw new NanoError('Invalid filter syntax');
			}

			for (const filter of filters) {
				if (RE_METHOD_INVALID.test(filter)) {
					throw new NanoError(`Invalid filter name: ${filter}`);
				}
			}

			return new Node(NODE_TYPES[2], return_tag_value(variable), { filters });
		} else {
			/* tag_variable */
			return new Node(NODE_TYPES[1], return_tag_value(token.value));
		}

		// if (token.value.includes('[')) {
		// 	const statement_parts = token.value.split(RE_SEPARATOR_BRACES);
		// 	const variable = statement_parts.shift();
		// 	const variables_nested = statement_parts.filter(v => v);

		// 	console.log(variable)

		// 	return new Node(NODE_TYPES[1], [ensure_valid_identifier(variable), ...variables_nested]);
		// } else {
		// 	return return_tag_value(token.value)
		// }

		function return_tag_value(variable) {
			if (RE_VARIABLE_QUOTED.test(variable)) {
				/* "quoted variable" */
				const variable_unquoted = variable.slice(1, -1);
				return new Node("value_text", variable_unquoted);
			}

			if (RE_VARIABLE_NAMED_KEY.test(variable)) {
				if (RE_SEPARATOR_DOT.test(variable) && RE_SEPARATOR_BRACES.test(variable)) {
					throw new NanoError('Avoid mixing variable access')
				}

				const variable_parts = variable.split(RE_SEPARATOR_BRACES);
				const variable_first = variable_parts.shift();
				const variables_nested = variable_parts.filter(v => v);

				return new Node("value_variable", [ensure_valid_identifier(variable_first), ...variables_nested]);
			}

			/* regular variable name, force dot separation */
			const variable_parts = variable.split(RE_SEPARATOR_DOT);

			for (const part of variable_parts) {
				ensure_valid_identifier(part, variable);
			}

			return new Node("value_variable", variable_parts);
		}

		function ensure_valid_identifier(variable, context) {
			if (!RE_VARIABLE_VALID.test(variable)) {
				throw new NanoError(`Invalid variable name: "${context || variable}"`)
			}

			return variable;
		}
	}

	function parse_comment(token) {
		return new Node('block_comment', token.value);
	}

	function parse_block(token) {
		return {};
	}

	function parse_text(token) {
		return new Node("value_html", token.value);
	}

	for (const token of tokens) {
		switch (token.type) {
			case TOKEN_TYPES[0]:
				nodes.push(parse_block(token));
				break;
			case TOKEN_TYPES[1]:
				nodes.push(parse_tag(token));
				break;
			case TOKEN_TYPES[2]:
				nodes.push(parse_comment(token));
				break;
			case TOKEN_TYPES[3]:
				nodes.push(parse_text(token));
				break;
		}
	}

	return nodes;
}

/**
 *
 *	2. COMPILE
 * 	nodes -> output
 *
 * 	interpreter that finally renders the nodes in relation
 * 	to the data object
 *
 * 	@@TODO: turn into async function
 *
 * */

export function compile(nodes, data) {}
