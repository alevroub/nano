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
 * 	input -> tokens -> marks
 *
 * 	lexer that splits the string builds a rough mark tree.
 * 	the goal in this step is to make sure the structure of all
 * 	blocks are valid, e.g. check for missing or duplicate tags.
 * 	invalid block statements or syntax errors are checked in the
 * 	next step when the marks are used to create nodes.
 *
 *		|	MARK TYPES
 *		|		0 - BLOCK   	{% if/else/for %}
 *		|		1 - VARIABLE	{{ variable }}
 *		|		2 - COMMENT 	{# comment #}
 *		|		3 - TEXT    	<div>text</div>
 *
 **/

class NanoError extends Error {
	public name = 'NanoSyntaxError';
}

// type Mark = {
// 	type: string;
// 	value: string;
// 	marks?: Array<Mark>;
// };

// type Node = {
// 	type: string;
// };

// type ExpressionLogicalNode & Node {
// 	left: string;
// 	right: string;
// 	operator: string;
// }

const RE_BLOCK = /^{%.*?%}$/;
const RE_TAG = /^{{.*?}}$/;
const RE_COMMENT = /^{#[^]*?#}$/;
const RE_ALL = /({%.*?%}|{{.*?}}|{#[^]*?#})/;

const MARK_TYPES = [
	'block',
	'tag',
	'comment',
	'text'
];

class Mark {
	constructor(type, value) {
		this.type = type;
		this.value = value;

		if (type === MARK_TYPES[0]) {
			this.marks = [];
		}
	}
}

export function scan(input: string): Marks {
	const marks = [];
	const block_stack = [];
	const tokens = input.split(RE_ALL).filter(v => v);

	for (const token of tokens) {
		const mark_type = return_mark_type(token);
		const mark_content = mark_type !== MARK_TYPES[3] ? token.slice(2, -2).trim() : token;

		if (mark_type === MARK_TYPES[0]) {
			if (mark_content.startsWith('end')) {
				const end_statement_type = mark_content.slice(3); //endif -> if
				let last_mark = block_stack.pop();

				if (last_mark.value === 'else') {
					/**
					 * if-else exception: first push the else-mark to the stack
					 * to keep its value and then skip to the next mark (pop).
					 * the next mark has to be an if statement, otherwise a
					 * statement mismatch will occur throwing a syntax error
					 **/

					output_mark(last_mark);
					last_mark = block_stack.pop();
				}

				if (!last_mark) {
					throw new NanoError('Too many closing tags');
				}

				if (!last_mark.value.startsWith(end_statement_type)) {
					throw new NanoError('Invalid closing tag');
				}

				output_mark(last_mark);
			} else {
				block_stack.push(new Mark(mark_type, mark_content));
			}
		} else {
			output_mark(new Mark(mark_type, mark_content));
		}
	}

	if (block_stack.length > 0) {
		throw new NanoError('Missing closing tag');
	}

	function output_mark(mark) {
		if (block_stack.length > 0) {
			block_stack[block_stack.length - 1].marks.push(mark);
		} else {
			marks.push(mark);
		}
	}

	function return_mark_type(token) {
		if (RE_BLOCK.test(token)) {
			return MARK_TYPES[0];
		} else if (RE_TAG.test(token)) {
			return MARK_TYPES[1];
		} else if (RE_COMMENT.test(token)) {
			return MARK_TYPES[2];
		} else {
			return MARK_TYPES[3];
		}
	}

	return marks;
}

/**
 *
 * 2. PARSE
 * 	marks -> nodes
 *
 * 	parser that takes the initial tree of marks and builds a tree of
 * 	nodes with more information about each mark match. this step takes
 * 	care of syntax formatting and should provide all relevant properties
 * 	to the renderer.
 *
 * 	|	NODE TYPES
 * 	|		[x] value_text                		<div>hello</div>
 * 	|		[x] value_identifier          		variable.dot.separated *OR* variable['named-key']
 * 	|		[x] expression_value          		{{ variable.dot.separated }} *OR* {{ variable['named-key'] }}
 * 	|		[x] expression_filter         		{{ variable | filter_name }}
 * 	|		[x] expression_conditional    		{{ variable ? 'value_if_true' : 'value_if_false' }}
 * 	|		[ ] expression_logical....    		{{ A or B }} {{ A and B }}
 * 	|		[ ] block_comment             		{# commented #}
 * 	|		[ ] block_if                  		{% if variable_1 %}
 * 	|		[ ] block_for                 		{% for (num, index) in numbers | unique %}
 * 	|		[ ] block_include             		{@ 'path/to/file.html' @}
 * 	|		[ ] expression_logical_and    		and variable
 * 	|		[ ] expression_logical_or     		or variable
 * 	|		[ ] expression_binary         		is value
 * 	|		[ ] expression_binary_negated 		is not value
 *
 **/

export function parse(marks) {
	const NODE_TYPES = [
		'value_text',
		'value_variable',
		'expression_value',
		'expression_filter',
		'expression_conditional',
		'expression_logical',
		'block_comment',
		'block_if',
		'block_for',
		'block_include',
	];

	class Node {
		constructor(type, properties) {
			this.type = type;

			for (const key in properties) {
				this[key] = properties[key];
			}
		}
	}

	const RE_OPERATOR_FILTER = / ?\| ?/;
	const RE_OPERATOR_TERNARY = /[?:]/;
	const RE_ACCESS_DOT = /\./;
	const RE_ACCESS_BRACKET = /\[["']|['"]\]/;

	const RE_VARIABLE_EXPRESSION_LIKE = /[\&\|\<\>\+\-\=\!\{\}\,]/;
	const RE_VARIABLE_IN_QUOTES = /^['"].+?['"]$/;
	const RE_VARIABLE_BRACKET_NOTATION = /\[['"]/;
	const RE_VARIABLE_DIGIT = /^-?(\d|\.\d)+$/;
	const RE_VARIABLE_VALID = /^[^0-9][0-9a-zA-Z]*$/;

	const RE_METHOD_INVALID = /[\- ]/;

	const RE_KEYWORD_IF = /^if\ /;
	const RE_KEYWORD_FOR = /^(for)|(in)/;
	const RE_OPERATOR_LOGICAL = /\ (and|or)\ /;

	const nodes = [];

	function ensure_valid_identifier(identifier: string, context: string) {
		if (!RE_VARIABLE_VALID.test(identifier)) {
			throw new NanoError(`Invalid variable name: "${context || identifier}"`);
		}

		return identifier;
	}

	function parse_value(value_string: string) {
		if (RE_VARIABLE_IN_QUOTES.test(value_string)) {
			return new Node("VALUE_TEXT", {
				value: value_string.slice(1, -1)
			});
		}

		if (RE_VARIABLE_BRACKET_NOTATION.test(value_string)) {
			if (RE_ACCESS_DOT.test(value_string) && RE_ACCESS_BRACKET.test(value_string)) {
				throw new NanoError('Avoid combined object access notation');
			}

			/**
			 * variable_root["nested"]["properties"]
			 *
			 * nested properties are parsed as strings by default and
			 * therefore don't have to be checked as valid identifiers
			 * to the same extent
			 */

			const variable_parts = value_string.split(RE_ACCESS_BRACKET);
			const variable_root = variable_parts.shift();
			const variables_nested = variable_parts.filter(v => v);

			return new Node("VALUE_VARIABLE", {
				properties: [ensure_valid_identifier(variable_root), ...variables_nested]
			});
		}

		const variable_parts = value_string.split(RE_ACCESS_DOT);

		for (const part of variable_parts) {
			ensure_valid_identifier(part, value_string);
		}

		return new Node("VALUE_VARIABLE", {
			properties: variable_parts
		});
	}

	function parse_expression_conditional(mark) {
		const statement_segments = mark.value.split(RE_OPERATOR_TERNARY).map(v => v.trim());
		const statement_test = parse_expression_logical(statement_segments.shift());
		const statement_consequent_alternate = [];

		/* test, consequent, alternate */

		if (statement_segments.length !== 3) {
			throw new NanoError('Invalid conditional expression');
		}

		for (const part of statement_segments) {
			statement_consequent_alternate.push(parse_value(part));
		}

		return new Node(NODE_TYPES[4], statement_consequent_alternate);
	}

	function parse_expression_filter(mark) {
		const statement_parts = mark.value.split(RE_OPERATOR_FILTER).map(v => v.trim());
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

		return new Node("EXPRESSION_FILTER", {
			value: parse_value(variable),
			filters: filters
		});
	}

	function parse_expression_value(mark) {
		return new Node("EXPRESSION_VALUE", {
			value: parse_value(mark.value)
		});
	}

	function parse_expression(expression_string: string) {
		/* only logical expressions for now basically */
	}

	/**
	 * inner blocks
	 * */

	function parse_block_if(mark) {
		const condition_expression = mark.value.split(RE_KEYWORD_IF).filter(v => v).pop();
		const condition_parsed = parse_expression(condition_expression);

		const last_mark = mark.marks[mark.marks.length - 1];
		const else_condition = last_mark.type === "block" && last_mark.value === 'else' ? mark.marks.pop() : null;

		// if (!condition) {
		// 	throw new NanoError('Missing condition in if statement');
		// }

		return new Node('BLOCK_IF', {
			condition: condition_parsed,
			consequent: '',
			alternate: ''
		});
	}

	function parse_block_for(mark) {
		const statement_parts = mark.value.split(' ');
		return new Node('BLOCK_FOR', mark.value);
	}

	/**
	 * outer blocks
	 * */

	function parse_tag(mark) {
		if (mark.value.includes('?')) {
			return parse_expression_conditional(mark);
		}

		if (mark.value.includes('|')) {
			return parse_expression_filter(mark);
		}

		return parse_expression_value(mark);
	}

	function parse_block(mark) {
		if (mark.value.startsWith('if ')) {
			return parse_block_if(mark);
		}

		if (mark.value.startsWith('for ')) {
			return parse_block_for(mark);
		}

		throw new NanoError('Invalid block statement')
	}

	function parse_comment(mark) {
		return new Node("BLOCK_COMMENT", {
			value: mark.value
		});
	}

	function parse_text(mark) {
		return new Node("VALUE_TEXT", {
			value: mark.value
		});
	}

	for (const mark of marks) {
		switch (mark.type) {
			case MARK_TYPES[0]:
				nodes.push(parse_block(mark));
				break;
			case MARK_TYPES[1]:
				nodes.push(parse_tag(mark));
				break;
			case MARK_TYPES[2]:
				nodes.push(parse_comment(mark));
				break;
			case MARK_TYPES[3]:
				nodes.push(parse_text(mark));
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

export function evaluate(nodes, data) {}
