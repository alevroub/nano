// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 *
 * 	v0.0.15
 *
 * 	Nano is a template engine initially made for use with Deno Deploy, which currently
 * 	doesn't support template engines that rely on eval() for evaluating expressions
 * 	at runtime. Nano currently supports logical and binary expressions but only using
 * 	variables passed during the rendering phase or primitive values i.e. strings, numbers
 * 	and booleans. Nano does still support all the basics like if/elseif/else/for statements,
 * 	nested loops, filters, and imports with props. Nano inherits most of its syntax
 * 	from the most commonly known template engines like Django, Twig, etc.
 *
 * 	USAGE
 * 	|	const template  =  <div>Hello {{ name | shout }}</div>
 * 	|	const data      =  { name: "Alejandro" }
 * 	|	const filters   =  { shout: value => value + '!' }
 * 	|	const options   =  {}
 * 	|
 * 	|	>  await render(template, data, filters, options)
 * 	|	>  <div>Hello Alejandro!</div>
 *
 * 	OPTIONS
 * 	|	show_comments (default: false)	| whether to include {# comments #}
 * 	|	                              	| in the rendered output
 * 	|
 * 	|	import_path   (default: '')   	| path to prepend to filepath
 * 	|	                              	| in {% import 'filepath' %}
 *
 * 	EXAMPLES
 * 	|	{% for item, index in array_like | unique %}
 * 	|		{{ item.a | lowercase }}
 * 	|	{% endfor %}
 * 	|
 * 	|	{% for key, value in object_like | filtered | sorted %}
 * 	|		{{ value['nested']['property'] | uppercase }}
 * 	|	{% endfor %}
 * 	|
 * 	|	{# comments #}
 * 	|
 * 	|	{% if some_variable %}
 * 	|		{{ import 'a.html' with { scoped: some_variable | uppercase } }}
 * 	|	{% elseif some.string is "foo" or some.number is not 100 %}
 * 	|		{{ import 'b.html' }}
 * 	|	{% else %}
 * 	|		{{ import 'c.html' }}
 * 	|	{% endif %}
 * 	|
 * 	|	{% for i in rows %}
 * 	|		{% for j in columns %}
 * 	|			<div>{{ i | is_even ? "even" : "odd" }}</div>
 * 	|		{% endfor %}
 * 	|	{% endfor %}
 *
 * 	INB4
 * 	|	could have
 * 	|		[ ] special variables inside loops like $loop.first and $loop.last
 * 	|		[ ] proper mark/node types zzZzZzZzz...
 * 	|		[ ] additional expressions and groups: >, >=, <, <= ( )
 * 	|	won't have
 * 	|		[x] inline object-like variable definitions and/or expressions -> {{ [1, 2, 2, 3] | unique }}
 *
 */

/**
 *
 * 	SCAN
 * 	input -> tokens -> marks
 *
 * 	lexer that splits the string builds a rough mark tree.
 * 	the goal in this step is to make sure the structure of all
 * 	blocks are valid, e.g. check for missing or duplicate tags.
 * 	invalid block statements or syntax errors are checked in the
 * 	next step when the marks are used to create nodes.
 *
 * 	|	0	BLOCK   		{% if/else/for %}
 * 	|	1	VARIABLE		{{ variable }}
 * 	|	2	COMMENT 		{# comment #}
 * 	|	3	TEXT    		<div>text</div>
 *
 **/

import { join as join_path } from "https://deno.land/std@0.148.0/path/mod.ts";

class NanoError extends Error {
	public name = 'NanoError';
}

class Mark {
	type: string;
	value: string;
	marks: Mark[];

	constructor(type: string, value: string, marks: Mark[] = []) {
		this.type = type;
		this.value = value;
		this.marks = marks;
	}
}

type Token = string;

const MARK_TYPES = [
	'block',
	'tag',
	'comment',
	'text'
];

export function scan(input: string): Mark[] {
	const RE_BLOCK = /^{%.*?%}$/;
	const RE_TAG = /^{{.*?}}$/;
	const RE_COMMENT = /^{#[^]*?#}$/;
	const RE_ALL = /({%.*?%}|{{.*?}}|{#[^]*?#})/;
	const RE_PRE = /<pre>[^]*?<\/pre>/g;
	const RE_BREAK = /[\n\r\t]/g;
	const RE_STACK_BLOCK_TAG = /^\bif\b|^\bfor\b/;
	const RE_VALID_BLOCK_TAG = /^\bif\b|^\bfor\b|^\belseif\b|^\belse\b/;

	const marks: Mark[] = [];
	const mark_stack: Mark[] = [];
	const operation_stack: string[] = [];
	const tokens: Token[] = trim_input(input).split(RE_ALL).filter(v => v);

	for (let i = 0; i < tokens.length; i += 1) {
		const mark_type = return_mark_type(tokens[i]);
		let mark_value = tokens[i];

		if (mark_type !== MARK_TYPES[3]) {
			mark_value = mark_value.slice(2, -2).trim();
		}

		if (mark_type === MARK_TYPES[0]) {
			if (mark_value.startsWith('end')) {
				let last_in_stack = mark_stack.pop() as Mark;

				const last_operation = operation_stack.pop();
				const end_statement = mark_value.slice(3);

				if (!RE_VALID_BLOCK_TAG.test(end_statement)) {
					throw new NanoError(`Invalid {% ${mark_value} %} tag`);
				}

				if (!last_operation) {
					throw new NanoError(`Redundant {% ${mark_value} %} tag`);
				} else {
					const last_operation_statement = last_operation.match(RE_STACK_BLOCK_TAG);

					if (last_operation_statement && last_operation_statement.pop() !== end_statement) {
						throw new NanoError(`Invalid {% ${last_operation} %} statement`);
					}
				}

				traverse_mark_stack(last_in_stack, mark_type);
			} else {
				if (!RE_VALID_BLOCK_TAG.test(mark_value)) {
					throw new NanoError(`Invalid {% ${mark_value} %} statement`);
				}

				if (RE_STACK_BLOCK_TAG.test(mark_value)) {
					operation_stack.push(mark_value);
				}

				mark_stack.push(new Mark(mark_type, mark_value));
			}
		} else {
			output_mark(new Mark(mark_type, mark_value));
		}
	}

	if (mark_stack.length > 0) {
		throw new NanoError(`Missing end tag inside {% ${mark_stack[0].value} %} block`);
	}

	function trim_input(raw_input: string) {
		const input_pre = raw_input.match(RE_PRE);
		const input_trim = raw_input.replace(RE_BREAK, '');

		raw_input = input_trim;

		if (input_pre) {
			const input_trim_pre = input_trim.match(RE_PRE);

			if (input_trim_pre) {
				for (let match = 0; match < input_pre.length; match += 1) {
					raw_input = raw_input.replace(input_trim_pre[match], input_pre[match]);
				}
			}
		}

		return raw_input;
	}

	function traverse_mark_stack(last_in_stack: Mark, mark_type: string) {
		if (last_in_stack.value.startsWith('elseif')) {
			const else_mark = new Mark(mark_type, 'else');
			const if_mark = new Mark(mark_type, last_in_stack.value.slice(4), last_in_stack.marks);

			mark_stack.push(else_mark);
			output_mark(if_mark);
		} else {
			output_mark(last_in_stack);
		}

		if (last_in_stack.value.startsWith('else')) {
			last_in_stack = mark_stack.pop() as Mark;
			traverse_mark_stack(last_in_stack, mark_type);
		}
	}

	function output_mark(mark: Mark) {
		if (mark_stack.length > 0) {
			mark_stack[mark_stack.length - 1].marks.push(mark);
		} else {
			marks.push(mark);
		}
	}

	function return_mark_type(token: Token) {
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
 * 	PARSE
 * 	marks -> nodes
 *
 * 	parser that takes the initial tree of marks and builds a tree of
 * 	nodes with more information about each mark match. this step takes
 * 	care of syntax formatting and should provide all relevant properties
 * 	to the renderer.
 *
 * 	|	0	value_text            		<div>text</div>
 * 	|	1	value_variable        		variable.dot.separated / variable['named-key']
 * 	|	2	expression_filter     		variable | filter | names
 * 	|	3	expression_conditional		variable ? 'value_if_true' : 'value_if_false'
 * 	|	4	expression_logical    		A or B and C
 * 	|	5	expression_unary      		not A
 * 	|	6	expression_binary     		is A
 * 	|	7	block_if              		{% if variable_1 and/or/not variable_2 %}
 * 	|	8	block_for             		{% for num, index in numbers | unique %}
 * 	|	9	block_comment         		{# multi-line comment #}
 * 	|	10	tag_import            		{{ import 'path/to/file.html' with { name: value } }}
 *
 **/

class Node {
	[key: string]: any;

	constructor(type: string, properties: any) {
		this.type = type;

		for (const key in properties) {
			this[key] = properties[key];
		}
	}
}

const NODE_TYPES = [
	'value_text',
	'value_variable',
	'expression_filter',
	'expression_conditional',
	'expression_logical',
	'expression_unary',
	'expression_binary',
	'block_if',
	'block_for',
	'block_comment',
	'tag_import',
];

export function parse(marks: Mark[]): Node[] {
	const RE_ACCESS_DOT = /\./;
	const RE_ACCESS_BRACKET = /\[["']|['"]\]/;
	const RE_VARIABLE_EXPRESSION_LIKE = /[\&\|\<\>\+\-\=\!\{\}\,]/;
	const RE_VARIABLE_EMPTY = /^['"]['"]$/;
	const RE_VARIABLE_IN_QUOTES = /^['"].+?['"]$/;
	const RE_VARIABLE_BRACKET_NOTATION = /\[['"]/;
	const RE_VARIABLE_DIGIT = /^-?(\d|\.\d)+$/;
	const RE_VARIABLE_BOOLEAN = /^(true|false)$/;
	const RE_VARIABLE_VALID = /^[0-9a-zA-Z_$]*$/;
	const RE_METHOD_INVALID = /[\- ]/;
	const RE_KEYWORD_IF = /^if /;
	const RE_KEYWORD_FOR = /^for | in /;
	const RE_KEYWORD_IMPORT = /^import | with /;
	const RE_OPERATOR_NOT = /not /;
	const RE_OPERATOR_AND = / and /;
	const RE_OPERATOR_OR = / or /;
	const RE_OPERATOR_BINARY = / is /;
	const RE_OPERATOR_LOGICAL = /not |( and | or )/;
	const RE_OPERATOR_FILTER = / ?\| ?/;
	const RE_OPERATOR_TERNARY = /[?:]/;
	const RE_OPERATOR_INDEX = /\, ?/;

	const nodes = [];

	function parse_value_text(mark: Mark) {
		return new Node(NODE_TYPES[0], {
			value: mark.value,
		});
	}

	function parse_value_variable(value_string: string): Node {
		if (RE_VARIABLE_IN_QUOTES.test(value_string)) {
			return new Node(NODE_TYPES[0], {
				value: value_string.slice(1, -1),
			});
		}

		if (RE_VARIABLE_DIGIT.test(value_string)) {
			return new Node(NODE_TYPES[0], {
				value: /\./.test(value_string) ? parseFloat(value_string) : parseInt(value_string),
			});
		}

		if (RE_VARIABLE_BOOLEAN.test(value_string)) {
			return new Node(NODE_TYPES[0], {
				value: value_string === 'true' ? true : false,
			});
		}

		if (RE_VARIABLE_BRACKET_NOTATION.test(value_string)) {
			if (RE_ACCESS_DOT.test(value_string) && RE_ACCESS_BRACKET.test(value_string)) {
				throw new NanoError(`Avoid combined object access notation: "${value_string}"`);
			}

			const variable_parts = value_string.split(RE_ACCESS_BRACKET);
			const variable_root = variable_parts.shift() as string;
			const variables_nested = variable_parts.filter(v => v);

			/**
			 * 	variable_root["nested"]["properties"] are parsed as strings
			 * 	by default and therefore don't have to be checked as valid
			 * 	identifiers to the same extent
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
			if (!RE_VARIABLE_EMPTY.test(part) && !RE_VARIABLE_VALID.test(part)) {
				throw new NanoError(`Invalid variable name: "${value_string}"`);
			}
		}

		return new Node(NODE_TYPES[1], {
			properties: variable_parts,
		});
	}

	function parse_expression_filter(expression_string: string): Node {
		const statement_parts = expression_string.split(RE_OPERATOR_FILTER).map(v => v.trim());
		const variable = statement_parts.shift() as string;
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
			value: parse_value_variable(variable),
			filters: filters,
		});
	}

	function parse_expression_conditional(expression_string: string): Node {
		const statement_parts = expression_string.split(RE_OPERATOR_TERNARY).map(v => v.trim());

		if (statement_parts.length < 3) {
			throw new NanoError('Invalid conditional expression');
		}

		const [test, consequent, alternate] = statement_parts;

		return new Node(NODE_TYPES[3], {
			test: parse_expression(test),
			consequent: parse_value_like_expression(consequent),
			alternate: parse_value_like_expression(alternate),
		});
	}

	function parse_expression_logical(expression_string: string): Node {
		/**
		 * 	A or B and C      	-->	A or (B and C)
		 * 	A and B or C and D 	-->	(A and B) or (C and D)
		 * 	A and B and C or D 	-->	((A and B) and C) or D
		 * 	not A and B or C    	-->	((not A) and B) or C
		 * */

		const split_or = expression_string.split(RE_OPERATOR_OR);

		if (split_or.length >= 2) {
			const split_operator = RE_OPERATOR_OR.toString().slice(1, -1);
			const [left, ...right] = split_or;

			return new Node(NODE_TYPES[4], {
				operator: 'or',
				left: parse_expression_logical(left),
				right: parse_expression_logical(right.join(split_operator)),
			});
		}

		const split_and = expression_string.split(RE_OPERATOR_AND);

		if (split_and.length >= 2) {
			const split_operator = RE_OPERATOR_AND.toString().slice(1, -1);
			const [left, ...right] = split_and;

			return new Node(NODE_TYPES[4], {
				operator: 'and',
				left: parse_expression_logical(left),
				right: parse_expression_logical(right.join(split_operator)),
			});
		}

		const split_not = expression_string.split(RE_OPERATOR_NOT);

		if (split_not.length >= 2) {
			const split_operator = RE_OPERATOR_NOT.toString().slice(1, -1).trim();
			const [left, ...right] = split_not;
			const not_value = right.map(match => match === "" ? split_operator : match);

			return new Node(NODE_TYPES[5], {
				operator: 'not',
				value: parse_expression_logical(not_value.join(' ')),
			});
		}

		return parse_expression(expression_string);
	}

	function parse_expression_binary(expression_string: string): Node {
		const statement_parts = expression_string.split(RE_OPERATOR_BINARY).map(v => v.trim());
		const [variable, value] = statement_parts;

		return new Node(NODE_TYPES[6], {
			variable: parse_expression(variable),
			value: parse_expression(value),
		});
	}

	function parse_value_like_expression(expression_string: string): Node {
		if (RE_OPERATOR_FILTER.test(expression_string)) {
			return parse_expression_filter(expression_string);
		}

		return parse_value_variable(expression_string);
	}

	function parse_expression(expression_string: string): Node {
		if (RE_OPERATOR_TERNARY.test(expression_string)) {
			return parse_expression_conditional(expression_string);
		}

		if (RE_OPERATOR_LOGICAL.test(expression_string)) {
			return parse_expression_logical(expression_string);
		}

		if (RE_OPERATOR_BINARY.test(expression_string)) {
			return parse_expression_binary(expression_string);
		}

		if (RE_OPERATOR_FILTER.test(expression_string)) {
			return parse_expression_filter(expression_string);
		}

		return parse_value_variable(expression_string);
	}

	function parse_block_if(mark: Mark): Node {
		const [test] = mark.value.split(RE_KEYWORD_IF).filter(v => v);

		function return_else_marks() {
			const last_mark = mark.marks[mark.marks.length - 1];
			const has_else_block = last_mark && last_mark.type === 'block' && last_mark.value === 'else';

			if (has_else_block) {
				const else_mark = mark.marks.pop() as Mark;
				return else_mark.marks;
			} else {
				return [];
			}
		}

		const else_marks = return_else_marks();
		const consequent = mark.marks.length > 0 ? mark.marks : null;
		const alternate = else_marks.length > 0 ? else_marks : null;

		return new Node(NODE_TYPES[7], {
			test: parse_expression(test),
			consequent: consequent ? parse(consequent) : null,
			alternate: alternate ? parse(alternate) : null,
		});
	}

	function parse_block_for(mark: Mark): Node {
		const statement_parts = mark.value.split(RE_KEYWORD_FOR).filter(v => v);

		if (statement_parts.length !== 2) {
			throw new NanoError('Invalid for statement');
		}

		const [variable, iterator] = statement_parts;
		const variable_parts = variable.split(RE_OPERATOR_INDEX);

		for (const part of variable_parts) {
			if (!RE_VARIABLE_VALID.test(part)) {
				throw new NanoError(`Invalid variable name: "${part}"`);
			}
		}

		return new Node(NODE_TYPES[8], {
			variables: variable_parts,
			iterator: parse_expression(iterator),
			body: parse(mark.marks),
		});
	}

	function parse_block_comment(mark: Mark): Node {
		return new Node(NODE_TYPES[9], {
			value: mark.value,
		});
	}

	function parse_tag_import(mark: Mark): Node {
		const [ filepath, variables ] = mark.value.split(RE_KEYWORD_IMPORT).filter(v => v).map(v => v.trim());
		const trimmed_filepath = filepath.slice(1, -1);

		if (!RE_VARIABLE_IN_QUOTES.test(filepath)) {
			throw new NanoError('Import path must be in quotes');
		}

		if (!trimmed_filepath) {
			throw new NanoError('Invalid import path');
		}

		return new Node(NODE_TYPES[10], {
			path: trimmed_filepath,
			variables: variables ? return_object_map(variables) : null,
		});

		function return_object_map(variables: string): Node {
			try {
				const list = variables.slice(1, -1).trim();
				const pairs = list.split(',').map(v => v.trim());

				return pairs.reduce((map, pair) => {
					const [key, value] = pair.split(':').map(v => v.trim());
					return { ...map, [key]: parse_expression(value) };
				}, {});
			} catch {
				throw new NanoError('Invalid import variable object');
			}
		}
	}

	function render_block_mark(mark: Mark): Node {
		if (mark.value.startsWith('if ')) {
			return parse_block_if(mark);
		}

		if (mark.value.startsWith('for ')) {
			return parse_block_for(mark);
		}

		throw new NanoError(`Invalid {% ${mark.value} %} block`);
	}

	function render_tag_mark(mark: Mark): Node {
		if (RE_KEYWORD_IMPORT.test(mark.value)) {
			return parse_tag_import(mark);
		}

		return parse_expression(mark.value);
	}

	function render_comment_mark(mark: Mark): Node {
		return parse_block_comment(mark);
	}

	function render_text_mark(mark: Mark): Node {
		return parse_value_text(mark);
	}

	for (const mark of marks) {
		switch (mark.type) {
			case MARK_TYPES[0]:
				nodes.push(render_block_mark(mark));
				break;
			case MARK_TYPES[1]:
				nodes.push(render_tag_mark(mark));
				break;
			case MARK_TYPES[2]:
				nodes.push(render_comment_mark(mark));
				break;
			case MARK_TYPES[3]:
				nodes.push(render_text_mark(mark));
				break;
		}
	}

	return nodes;
}

/**
 *
 * 	COMPILE
 * 	nodes -> output
 *
 * 	interpreter that finally renders the nodes in relation
 * 	to the data object. this function has to be async because
 * 	Deno Deploy doesn't support readFileSync yet.
 *
 * */

type NanoInputData = {
	[key: string]: any;
};

type NanoInputMethods = {
	[key: string]: (...args: any[]) => any;
};

type NanoOptions = {
	show_comments?: boolean;
	import_path?: string;
};

export async function compile(nodes: Node[], input_data: NanoInputData = {}, input_methods: NanoInputMethods = {}, input_options?: NanoOptions): Promise<string> {
	const default_options: NanoOptions = { show_comments: false, import_path: '' };
	const compile_options: NanoOptions = { ...default_options, ...input_options };

	const output: string[] = [];

	function return_type(value: any): string {
		return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
	}

	async function compile_value_text(node: Node): Promise<string> {
		return node.value;
	}

	async function compile_value_variable(node: Node): Promise<any> {
		return node.properties.reduce((parent: any, property: string) => {
			if (parent !== undefined && parent[property] !== undefined) {
				return parent[property];
			}
		}, input_data);
	}

	async function compile_expression_filter(node: Node): Promise<any> {
		const variable_value = await compile_node(node.value);
		const filtered_value = node.filters.reduce((processed_value: any, filter: string) => {
			if (input_methods[filter] === undefined) {
				throw new NanoError(`Method "${filter}" is undefined`);
			}
			return input_methods[filter](processed_value);
		}, variable_value);

		return filtered_value;
	}

	async function compile_expression_conditional(node: Node): Promise<any> {
		const test = await compile_node(node.test);

		if (test) {
			return compile_node(node.consequent);
		} else {
			return compile_node(node.alternate);
		}
	}

	async function compile_expression_logical(node: Node): Promise<boolean | undefined> {
		const left = await compile_node(node.left);
		const right = await compile_node(node.right);

		if (node.operator === 'and') {
			return left && right;
		}

		if (node.operator === 'or') {
			return left || right;
		}
	}

	async function compile_expression_binary(node: Node): Promise<boolean> {
		const variable = await compile_node(node.variable);
		const value = await compile_node(node.value);

		if (node.value.operator && node.value.operator === 'not') {
			const node_value = await compile_node(node.value.value);
			return variable !== node_value;
		} else {
			return variable === value;
		}
	}

	async function compile_expression_unary(node: Node): Promise<boolean | undefined> {
		const value = await compile_node(node.value);

		if (node.operator === 'not') {
			return !value;
		}
	}

	async function compile_block_if(node: Node): Promise<string> {
		const block_output: string[] = [];
		const test = await compile_node(node.test);

		if (test) {
			if (node.consequent) {
				block_output.push(await compile(node.consequent, input_data, input_methods, compile_options));
			}
		} else {
			if (node.alternate) {
				block_output.push(await compile(node.alternate, input_data, input_methods, compile_options));
			}
		}

		return block_output.join('');
	}

	async function compile_block_for(node: Node): Promise<string> {
		const block_context: any = {};
		const block_output: string[] = [];
		const loop_iterator = await compile_node(node.iterator);
		const iterator_type = return_type(loop_iterator);

		if (iterator_type === 'object') {
			const [for_key, for_value] = node.variables;

			for (const [loop_index, loop_key] of Object.keys(loop_iterator).entries()) {
				const block_data = { ...input_data };

				if (for_value) {
					block_data[for_key] = loop_key;
					block_data[for_value] = loop_iterator[loop_key];
				} else {
					block_data[for_key] = loop_iterator[loop_key];
				}

				block_output.push(await compile(node.body, block_data, input_methods, compile_options));
			}
		} else if (iterator_type === 'array') {
			const [for_variable, for_index] = node.variables;

			for (const [loop_index, loop_data] of loop_iterator.entries()) {
				const block_data = { ...input_data };

				block_data[for_variable] = loop_data;

				if (for_index) {
					block_data[for_index] = loop_index;
				}

				block_output.push(await compile(node.body, block_data, input_methods, compile_options));
			}
		} else {
			throw new NanoError(
				`Variable "${node.iterator.properties[node.iterator.properties.length - 1]}" is not iterable`
			);
		}

		return block_output.join('');
	}

	async function compile_block_comment(node: Node): Promise<string> {
		return compile_options.show_comments ? `<!-- ${node.value} -->` : '';
	}

	async function compile_tag_import(node: Node): Promise<string> {
		const import_path_dir = compile_options.import_path || default_options.import_path;
		const import_file_path = join_path(import_path_dir, node.path);

		try {
			const import_file = await Deno.readTextFile(import_file_path);
			const import_data = node.variables ? await compile_scoped_variables(node.variables) : input_data;

			async function compile_scoped_variables(variables: Record<string, Node>) {
				const scoped_variables: Record<string, any> = {};

				for (const key of Object.keys(variables)) {
					scoped_variables[key] = await compile_node(variables[key]);
				}

				return scoped_variables;
			}

			return compile(parse(scan(import_file)), import_data, input_methods, compile_options);
		} catch(error) {
			throw new NanoError(`Imported file does not exist: ${import_file_path}`);
		}
	}

	async function compile_node(node: Node): Promise<any> {
		if (node.type === NODE_TYPES[0]) {
			return compile_value_text(node);
		}

		if (node.type === NODE_TYPES[1]) {
			return compile_value_variable(node);
		}

		if (node.type === NODE_TYPES[2]) {
			return compile_expression_filter(node);
		}

		if (node.type === NODE_TYPES[3]) {
			return compile_expression_conditional(node);
		}

		if (node.type === NODE_TYPES[4]) {
			return compile_expression_logical(node);
		}

		if (node.type === NODE_TYPES[5]) {
			return compile_expression_unary(node);
		}

		if (node.type === NODE_TYPES[6]) {
			return compile_expression_binary(node);
		}

		if (node.type === NODE_TYPES[7]) {
			return compile_block_if(node);
		}

		if (node.type === NODE_TYPES[8]) {
			return compile_block_for(node);
		}

		if (node.type === NODE_TYPES[9]) {
			return compile_block_comment(node);
		}

		if (node.type === NODE_TYPES[10]) {
			return compile_tag_import(node);
		}
	}

	for (const node of nodes) {
		output.push(await compile_node(node));
	}

	return output.join('');
}

export async function render(input: string, input_data: NanoInputData = {}, input_methods: NanoInputMethods = {}, input_options?: NanoOptions) {
	return compile(parse(scan(input)), input_data, input_methods, input_options);
}
