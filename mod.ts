// Copyright (c) 2022 Alejandro V. Rojas. All rights reserved. MIT license.

/**
 *
 * 	v0.0.6
 *
 * 	Nano — a very simple (semi) logic-less template engine. This was initially
 * 	made for playing around with simple prototypes deployed with Deno Deploy,
 * 	which currently doesn't play very well with template engines that rely
 * 	on evaluating expressions at runtime. Nano currently supports logical
 * 	expressions but only with defined variables. Nano has support for all
 * 	the basics like if/for statements, nested loops, filters, and imports.
 * 	Nano inherits its syntax from the most commonly known template engines
 * 	like Django, Twig, etc.
 *
 * 	|	should have
 * 	|		[ ] write proper mark/node types zzZzZzZzz...
 * 	|	could have
 * 	|		[ ] binary expressions and groups: == != >, >=, <, <= ( )
 * 	|	won't have
 * 	|		[x] inline variable definitions {{ [1, 2, 2, 3] | unique }}
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

class NanoError extends Error {
	public name = 'NanoSyntaxError';
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
	const RE_STACK_BLOCK_TAG = /^\bif\b|^\bfor\b/;
	const RE_VALID_BLOCK_TAG = /^\bif\b|^\bfor\b|^\belseif\b|^\belse\b/;

	const marks: Mark[] = [];
	const mark_stack: Mark[] = [];
	const operation_stack: string[] = [];
	const tokens: Token[] = input.split(RE_ALL).filter(v => v);

	for (const token of tokens) {
		const mark_type = return_mark_type(token);
		const mark_value = mark_type !== MARK_TYPES[3] ? token.slice(2, -2).trim() : token;

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
					throw new NanoError(`Invalid {% ${mark_value} %} statement`)
				}

				if (RE_STACK_BLOCK_TAG.test(mark_value)) {
					operation_stack.push(mark_value)
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
 * 	|	6	block_if              		{% if variable_1 and/or/not variable_2 %}
 * 	|	7	block_for             		{% for num, index in numbers | unique %}
 * 	|	8	block_comment         		{# multi-line comment #}
 * 	|	9	tag_import            		{{ import 'path/to/file.html' }}
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
	'block_if',
	'block_for',
	'block_comment',
	'tag_import',
];

export function parse(marks: Mark[]): Node[] {
	const RE_ACCESS_DOT = /\./;
	const RE_ACCESS_BRACKET = /\[["']|['"]\]/;
	const RE_VARIABLE_EXPRESSION_LIKE = /[\&\|\<\>\+\-\=\!\{\}\,]/;
	const RE_VARIABLE_IN_QUOTES = /^['"].+?['"]$/;
	const RE_VARIABLE_BRACKET_NOTATION = /\[['"]/;
	const RE_VARIABLE_DIGIT = /^-?(\d|\.\d)+$/;
	const RE_VARIABLE_VALID = /^[0-9a-zA-Z_$]*$/;
	const RE_METHOD_INVALID = /[\- ]/;
	const RE_KEYWORD_IF = /^if /;
	const RE_KEYWORD_FOR = /^for | in /;
	const RE_KEYWORD_IMPORT = /^import /;
	const RE_OPERATOR_NOT = /^not /;
	const RE_OPERATOR_AND = / and /;
	const RE_OPERATOR_OR = / or /;
	const RE_OPERATOR_LOGICAL = /not |( and | or )/;
	const RE_OPERATOR_FILTER = / ?\| ?/;
	const RE_OPERATOR_TERNARY = /[?:]/;
	const RE_OPERATOR_INDEX = /\, ?/;

	const nodes = [];

	function parse_value(value_string: string): Node {
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
			if (!RE_VARIABLE_VALID.test(part)) {
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
			value: parse_value(variable),
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
			consequent: parse_expression(consequent),
			alternate: parse_expression(alternate),
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

		if (split_or.length === 2) {
			const [left, right] = split_or;

			return new Node(NODE_TYPES[4], {
				operator: 'or',
				left: parse_expression_logical(left),
				right: parse_expression_logical(right),
			});
		}

		const split_and = expression_string.split(RE_OPERATOR_AND);

		if (split_and.length === 2) {
			const [left, right] = split_and;

			return new Node(NODE_TYPES[4], {
				operator: 'and',
				left: parse_expression_logical(left),
				right: parse_expression_logical(right),
			});
		}

		const split_not = expression_string.split(RE_OPERATOR_NOT);

		if (split_not.length === 2) {
			const [operator, value] = split_not;

			return new Node(NODE_TYPES[5], {
				operator: 'not',
				value: parse_expression_logical(value),
			});
		}

		return parse_expression(expression_string);
	}

	function parse_expression(expression_string: string): Node {
		if (RE_OPERATOR_TERNARY.test(expression_string)) {
			return parse_expression_conditional(expression_string);
		}

		if (RE_OPERATOR_LOGICAL.test(expression_string)) {
			return parse_expression_logical(expression_string);
		}

		if (RE_OPERATOR_FILTER.test(expression_string)) {
			return parse_expression_filter(expression_string);
		}

		return parse_value(expression_string);
	}

	function parse_block_if_mark(mark: Mark): Node {
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

		return new Node(NODE_TYPES[6], {
			test: parse_expression(test),
			consequent: consequent ? parse(consequent) : null,
			alternate: alternate ? parse(alternate) : null,
		});
	}

	function parse_block_for_mark(mark: Mark): Node {
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

		return new Node(NODE_TYPES[7], {
			variables: variable_parts,
			iterator: parse_expression(iterator),
			body: parse(mark.marks),
		});
	}

	function parse_block_mark(mark: Mark): Node {
		if (mark.value.startsWith('if ')) {
			return parse_block_if_mark(mark);
		}

		if (mark.value.startsWith('for ')) {
			return parse_block_for_mark(mark);
		}

		throw new NanoError('Invalid block statement');
	}

	function parse_tag_import(mark: Mark): Node {
		const filepath = mark.value.split(RE_KEYWORD_IMPORT).pop() as string;
		const filepath_unquoted: string = filepath.slice(1, -1);

		if (!filepath_unquoted) {
			throw new NanoError('Invalid import path');
		}

		if (!RE_VARIABLE_IN_QUOTES.test(filepath)) {
			throw new NanoError('Import path must be in quotes');
		}

		return new Node(NODE_TYPES[9], {
			path: filepath_unquoted,
		});
	}

	function parse_tag_mark(mark: Mark): Node {
		if (RE_KEYWORD_IMPORT.test(mark.value)) {
			return parse_tag_import(mark);
		}

		return parse_expression(mark.value);
	}

	function parse_comment_mark(mark: Mark): Node {
		return new Node(NODE_TYPES[8], {
			value: mark.value,
		});
	}

	function parse_text_mark(mark: Mark): Node {
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
 * 	COMPILE
 * 	nodes -> output
 *
 * 	interpreter that finally renders the nodes in relation
 * 	to the data object. this function has to be async because
 * 	Deno Deploy doesn't support readFileSync yet.
 *
 * */

type InputData = {
	[key: string]: any;
};

type InputMethods = {
	[key: string]: (...args: any[]) => any;
};

type NanoOptions = {
	show_comments?: boolean;
	import_path?: string;
};

export async function compile(nodes: Node[], input_data: InputData = {}, input_methods: InputMethods = {}, input_options?: NanoOptions): Promise<string> {
	const default_options: NanoOptions = { show_comments: false, import_path: '' };
	const compile_options: NanoOptions = { ...default_options, ...input_options };

	const output: string[] = [];

	function return_type(value: any): string {
		return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
	}

	function return_value(properties: string[]): any {
		return properties.reduce((parent: any, property: string) => {
			if (parent[property] !== undefined) {
				return parent[property];
			}
		}, input_data);
	}

	function return_value_filtered(properties: string[], filters: InputMethods): any {
		const variable_value = return_value(properties);
		const filtered_value = filters.reduce((processed_value: any, filter: string) => {
			if (input_methods[filter] === undefined) {
				throw new NanoError(`Method "${filter}" is undefined`);
			}
			return input_methods[filter](processed_value);
		}, variable_value);

		return filtered_value;
	}

	async function compile_value_text(node: Node): Promise<string> {
		return node.value;
	}

	async function compile_value_variable(node: Node): Promise<any> {
		return return_value(node.properties);
	}

	async function compile_expression_filter(node: Node): Promise<any> {
		return return_value_filtered(node.value.properties, node.filters);
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

	async function compile_expression_unary(node: Node): Promise<boolean | undefined> {
		const value = compile_node(node.value);

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
		const import_path = compile_options.import_path;
		const default_path = default_options.import_path;
		const import_path_dir = import_path ? import_path.endsWith('/') ? import_path : import_path + '/' : default_path;
		const import_file = await Deno.readTextFile(import_path_dir + node.path);

		return compile(parse(scan(import_file)), input_data, input_methods, compile_options);
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
			return compile_block_if(node);
		}

		if (node.type === NODE_TYPES[7]) {
			return compile_block_for(node);
		}

		if (node.type === NODE_TYPES[8]) {
			return compile_block_comment(node);
		}

		if (node.type === NODE_TYPES[9]) {
			return compile_tag_import(node);
		}
	}

	for (const node of nodes) {
		output.push(await compile_node(node));
	}

	return output.join('');
}

export async function render(input: string, input_data: InputData, input_methods?: InputMethods, input_options?: NanoOptions) {
	return compile(parse(scan(input)), input_data, input_methods, input_options);
}
