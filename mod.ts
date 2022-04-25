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
}

type Node = {
	type: string;
	value: string;
	properties?: Record<string, any>;
}

const RE_BLOCK =    	/{%.*?%}/;
const RE_VARIABLE = 	/{{.*?}}/;
const RE_COMMENT =  	/{#[^]*?#}/;
const RE_ALL =      	/({%.*?%}|{{.*?}}|{#[^]*?#})/;

const TOKEN_TYPES = [
	'block',   	// 0
	'variable',	// 1
	'comment', 	// 2
	'text'     	// 3
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
	const lexemes = input.split(RE_ALL);

	for (const lexeme of lexemes) {
		const matches_block = RE_BLOCK.test(lexeme);
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
 * 	|	POSSIBLE? NODE TYPES
 * 	|		value_raw            	<div>hello</div>
 * 	|		value_literal        	"quoted"
 * 	|		value_variable	      	variable.dot.separated
 * 	|		value_filter         	variable | filter_name
 * 	|		value_truthy         	value
 * 	|		value_truthy_negated 	not value
 * 	|		expression_ternary   	variable ? 'value_if_true' : 'value_if_false'
 * 	|		expression_logical   	variable and
 * 	|		tag_escaped         		{{{ variable_escaped }}}
 * 	|		tag_literal         		{{ variable }}
 * 	|		block_for           		{% for num, index in numbers | unique %}
 * 	|		block_if            		{% if variable_1 and not variable_3 %}
 * 	|		block_else          		{% else %}
 * 	|		block_include       		{@ 'path/to/file.html' @}
 * 	|		block_comment       		{# commented #}
 *
 **/

export function parse(tokens) {
	const nodes = [];

	class Node {
		constructor(type, value, properties) {
			this.type = type;
			this.value = value;

			if (properties) {
				this.properties = properties;
			}
		}
	}

	function parse_variable(token) {
		/* variable, variable dot, variable filter */
		return {};
	}

	function parse_comment(token) {
		return new Node("block_comment", token.value);
	}

	function parse_block(token) {
		return {};
	}

	function parse_text(token) {
		return new Node("value_raw", token.value);
	}

	for (const token of tokens) {
		switch(token.type) {
			case TOKEN_TYPES[0]:
				nodes.push(parse_block(token));
			break;
			case TOKEN_TYPES[1]:
				nodes.push(parse_variable(token));
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

export function compile(nodes, data) {

}