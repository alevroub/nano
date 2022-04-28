// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 * 
 * 	v0.0.2
 *
 * 	Nano template engine – a very simple (semi) logic-less template engine.
 * 	This was initially made for playing around with simple prototypes deployed
 * 	with Deno Deploy, which currently doesn't play very well with template
 * 	engines that rely on evaluating expressions at runtime. Nano doesn't support
 * 	expressions either (yet) but does work with all the basics like loops,
 * 	filters, imports, and simple if statements. Nano inherits its syntax from
 * 	the most commonly known template engines like Django, Jinja, Twig, etc.
 * 
 * 	BACKLOG
 * 	[?] function(syntax) for filters
 * 	[?] binary expressions and groups: == != >, >=, <, <= ( )
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
	const RE_BLOCK = /^{%.*?%}$/;
	const RE_TAG = /^{{.*?}}$/;
	const RE_COMMENT = /^{#[^]*?#}$/;
	const RE_ALL = /({%.*?%}|{{.*?}}|{#[^]*?#})/;

	const marks = [];
	const block_stack = [];
	const tokens = input.split(RE_ALL).filter(v => v);

	for (const token of tokens) {
		const mark_type = return_mark_type(token);
		const mark_value = mark_type !== MARK_TYPES[3] ? token.slice(2, -2).trim() : token;

		if (mark_type === MARK_TYPES[0]) {
			if (mark_value.startsWith('end')) {
				const end_statement_type = mark_value.slice(3); //endif -> if
				let last_mark = block_stack.pop();

				if (last_mark.value === 'else') {
					/**
					 * 
					 * 	first push the else-mark to the stack to keep its value 
					 * 	nested in the if-block and then skip to the next mark
					 * 	which has to be an if statement, otherwise a statement 
					 * 	mismatch will occur throwing a syntax error
					 * 
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
				block_stack.push(new Mark(mark_type, mark_value));
			}
		} else {
			output_mark(new Mark(mark_type, mark_value));
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
 * 	|		[x] value_text                		<div>text</div>
 * 	|		[x] value_variable            		variable.dot.separated / variable['named-key']
 * 	|		[x] expression_filter         		variable | filter | names
 * 	|		[x] expression_conditional    		variable ? 'value_if_true' : 'value_if_false'
 * 	|		[x] expression_logical        		A or B and C
 * 	|		[x] expression_unary          		not A
 * 	|		[x] block_if                  		{% if variable_1 %}
 * 	|		[ ] block_for                 		{% for num, index in numbers | unique %}
 * 	|		[x] block_comment             		{# commented #}
 * 	|		[x] tag_import                		{{ import 'path/to/file.html' }}
 *
 **/

const NODE_TYPES = [
	'value_text',
	'value_variable',
	'expression_filter',
	'expression_conditional',
	'expression_logical',
	'expression_unary',
	'block_if',
	'block_for',
	'block_comment',
	'tag_import',
];

class Node {
	constructor(type, properties) {
		this.type = type;

		for (const key in properties) {
			this[key] = properties[key];
		}
	}
}

export function parse(marks) {
	const RE_ACCESS_DOT = /\./;
	const RE_ACCESS_BRACKET = /\[["']|['"]\]/;
	const RE_VARIABLE_EXPRESSION_LIKE = /[\&\|\<\>\+\-\=\!\{\}\,]/;
	const RE_VARIABLE_IN_QUOTES = /^['"].+?['"]$/;
	const RE_VARIABLE_BRACKET_NOTATION = /\[['"]/;
	const RE_VARIABLE_DIGIT = /^-?(\d|\.\d)+$/;
	const RE_VARIABLE_VALID = /^[^0-9][0-9a-zA-Z_]*$/;
	const RE_METHOD_INVALID = /[\- ]/;
	const RE_KEYWORD_IF = /^if /;
	const RE_KEYWORD_FOR = /^for | in /;
	const RE_KEYWORD_IMPORT = /^import /;
	const RE_OPERATOR_NOT = /^not /;
	const RE_OPERATOR_AND = / and /;
	const RE_OPERATOR_OR = / or /;
	const RE_OPERATOR_LOGICAL = /( not | and | or )/;
	const RE_OPERATOR_FILTER = / ?\| ?/;
	const RE_OPERATOR_TERNARY = /[?:]/;

	const nodes = [];

	function parse_value(value_string: string) {
		if (RE_VARIABLE_IN_QUOTES.test(value_string)) {
			return new Node(NODE_TYPES[0], {
				value: value_string.slice(1, -1),
			});
		}

		if (RE_VARIABLE_BRACKET_NOTATION.test(value_string)) {
			if (RE_ACCESS_DOT.test(value_string) && RE_ACCESS_BRACKET.test(value_string)) {
				throw new NanoError(`Avoid combined object access notation: "${value_string}"`);
			}

			const variable_parts = value_string.split(RE_ACCESS_BRACKET);
			const variable_root = variable_parts.shift();
			const variables_nested = variable_parts.filter(v => v);

			/**
			 * 	variable_root["nested"]["properties"]
			 *
			 * 	nested properties are parsed as strings by default and
			 * 	therefore don't have to be checked as valid identifiers
			 * 	to the same extent
			 */

			if (!RE_VARIABLE_VALID.test(variable_root)) {
				throw new NanoError(`Invalid variable name: "${variable_root}"`);
			}

			return new Node(NODE_TYPES[1], {
				properties: [variable_root, ...variables_nested],
			});
		}

		const variable_parts = value_string.split(RE_ACCESS_DOT);

		for (const part of variable_parts) {
			if (!RE_VARIABLE_VALID.test(part)) {
				throw new NanoError(`Invalid variable name: "${value_string}"`);
			}
		}

		return new Node(NODE_TYPES[1], {
			properties: variable_parts,
		});
	}

	function parse_expression_filter(expression_string: string) {
		const statement_parts = expression_string.split(RE_OPERATOR_FILTER).map(v => v.trim());
		const variable = statement_parts.shift();
		const filters = statement_parts.filter(v => v);

		if (filters.length === 0) {
			throw new NanoError('Invalid filter syntax');
		}

		for (const filter of filters) {
			if (!RE_VARIABLE_VALID.test(filter)) {
				throw new NanoError(`Invalid filter name: "${filter}"`);
			}
		}

		return new Node(NODE_TYPES[2], {
			value: parse_value(variable),
			filters: filters,
		});
	}

	function parse_expression_conditional(expression_string: string) {
		const statement_parts = expression_string.split(RE_OPERATOR_TERNARY).map(v => v.trim());

		if (statement_parts.length < 3) {
			throw new NanoError('Invalid conditional expression');
		}

		const [test, consequent, alternate] = statement_parts;

		return new Node(NODE_TYPES[3], {
			test: parse_expression(test),
			consequent: parse_expression(consequent),
			alternate: parse_expression(alternate),
		});
	}

	function parse_expression_logical(expression_string: string) {
		/**
		 *
		 * 	only logical expressions for now
		 *
		 * 	| 	NOT 3
		 * 	| 	AND 2
		 * 	| 	OR  1
		 * 	|
		 * 	|	A or B and C      	-->	A or (B and C)
		 * 	|	A and B or C and D 	-->	(A and B) or (C and D)
		 * 	|	A and B and C or D 	-->	((A and B) and C) or D
		 * 	|	not A and B or C    	-->	((not A) and B) or C
		 *
		 * */

		const split_or = expression_string.split(RE_OPERATOR_OR);

		if (split_or.length === 3) {
			const [left, operator, right] = split_or;

			return new Node(NODE_TYPES[4], {
				left: parse_expression_logical(left),
				operator,
				right: parse_expression_logical(right),
			});
		}

		const split_and = expression_string.split(RE_OPERATOR_AND);

		if (split_and.length === 3) {
			const [left, operator, right] = split_and;

			return new Node(NODE_TYPES[4], {
				left: parse_expression_logical(left),
				operator,
				right: parse_expression_logical(right),
			});
		}

		const split_not = expression_string.split(RE_OPERATOR_NOT).filter(v => v);

		if (split_not.length === 2) {
			const [operator, value] = split_not;

			return new Node(NODE_TYPES[5], {
				operator,
				value: parse_expression_logical(value),
			});
		}

		return parse_value(expression_string);
	}

	function parse_expression(expression_string: string) {
		if (RE_OPERATOR_TERNARY.test(expression_string)) {
			return parse_expression_conditional(expression_string);
		}

		if (RE_OPERATOR_FILTER.test(expression_string)) {
			return parse_expression_filter(expression_string);
		}

		if (RE_OPERATOR_LOGICAL.test(expression_string)) {
			return parse_expression_logical(expression_string);
		}

		return parse_value(expression_string);
	}

	function parse_block_if_mark(mark) {
		const [test] = mark.value.split(RE_KEYWORD_IF).filter(v => v);

		function return_else_marks() {
			const last_mark = mark.marks[mark.marks.length - 1];
			const has_else_block = last_mark && last_mark.type === 'block' && last_mark.value === 'else';
			return has_else_block ? mark.marks.pop().marks : [];
		}

		const else_marks = return_else_marks();
		const consequent = mark.marks.length > 0 ? mark.marks : null;
		const alternate = else_marks.length > 0 ? else_marks : null;

		return new Node(NODE_TYPES[6], {
			test: parse_expression(test),
			consequent: consequent ? parse(consequent) : null,
			alternate: alternate ? parse(alternate) : null,
		});
	}

	function parse_block_for_mark(mark) {
		const statement_parts = mark.value.split(' ');
		return new Node(NODE_TYPES[7], mark.value);
	}

	function parse_block_mark(mark) {
		if (mark.value.startsWith('if ')) {
			return parse_block_if_mark(mark);
		}

		if (mark.value.startsWith('for ')) {
			return parse_block_for_mark(mark);
		}

		throw new NanoError('Invalid block statement');
	}

	function parse_tag_import(mark) {
		const filepath = mark.value.split(' ').pop().slice(1, -1);

		if (!filepath) {
			throw new NanoError('Invalid import path');
		}

		return new Node(NODE_TYPES[9], {
			path: filepath
		})
	}

	function parse_tag_mark(mark) {
		if (RE_KEYWORD_IMPORT.test(mark.value)) {
			return parse_tag_import(mark);
		}

		return parse_expression(mark.value);
	}

	function parse_comment_mark(mark) {
		return new Node(NODE_TYPES[8], {
			value: mark.value,
		});
	}

	function parse_text_mark(mark) {
		return new Node(NODE_TYPES[0], {
			value: mark.value,
		});
	}

	for (const mark of marks) {
		switch (mark.type) {
			case MARK_TYPES[0]:
				nodes.push(parse_block_mark(mark));
				break;
			case MARK_TYPES[1]:
				nodes.push(parse_tag_mark(mark));
				break;
			case MARK_TYPES[2]:
				nodes.push(parse_comment_mark(mark));
				break;
			case MARK_TYPES[3]:
				nodes.push(parse_text_mark(mark));
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
