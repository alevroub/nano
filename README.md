## Nano
Nano is a template engine initially made for use with Deno Deploy, which currently doesn't support template engines that rely on eval() for evaluating expressions at runtime. Nano currently supports logical and binary expressions but only using variables passed during the rendering phase and/or primitive values i.e. strings, numbers and booleans. Nano does still support all the basics like if/else/for statements, nested loops, filters, and imports with props. Nano inherits most of its syntax from the most commonly known template engines like Django, Twig, etc.

### Usage
As with most template engines, the output is rendered by combining a string template, a data object, and an optional set of filters.
```js
const template = `<div>Hello {{ name | shout }}</div>`;
const data = {
	name: "Alejandro"
};
const filters = {
	shout: (value: string) => `${value}!`
}

const result = await render(template, data, filters);
```

```html
<div>Hello Alejandro!</div>
```

### Options
An options object can be passed as fourth argument

```js
await render(template, data, filters, options);
```

- `display_comments` _(default: false)_
  - whether to display `{# comments #}` in the rendered output
- `import_path` _(default: '')_
  - path to prepend to all paths used in `{% import %}` blocks

### Syntax

#### Variable access
Both dot and bracket notation is supported
```twig
{{ value.nested.property }}
```
```twig
{{ value['nested']['property'] }}
```

#### Filters
Filters are functions that can be applied to any variable or primitive value. Filters don't support function arguments, but can be chained.
```twig
{{ "Hello" | to_lowercase }}
```
```twig
{{ my_array | first_item | to_uppercase }}
```

#### Ternary operator
```twig
{{ foo == true ? "yes" : "no" }}
```

#### Expressions
Nano support logical and binary expressions and can be used in combination with filters with any variable and/or primitive value
```twig
{{ foo == true && !bar || baz >= 10 | times_two ? "yes" | to_uppercase : "no" }}
```

#### If/else
```twig
{% if foo > 100 && bar <= 5 | times_two %}
	...
{% elseif baz != "something" || !foo %}
	...
{% else %}
	...
{% endif%}
```

#### Loops
```twig
{% for item in items %}
	...
{% endfor %}
```
It's possible to get the index in the loop
```twig
{% for item, index in items %}
	...
{% endfor %}
```
As well as loop over objects
```twig
{% for key, value in object %}
	...
{% endfor %}
```
Filters can also be applied to variables
```twig
{% for item, index in array | filtered | sorted %}
	...
{% endfor %}
```

#### Import
Source code can be imported from other sources.
```twig
{{ import 'subfolder/other_file.html' }}
```
The imported module will have access to the same data and filters from its parent scope:
```twig
{# main.html #}
{% for item in items %}
  {{ import 'file.html' }}
{% endfor %}

{# file.html #}
I can render {{ item }} from here.
```
However it's possible to pass variables as props which allows for greater reusability of components:
```twig
{# main.html #}
{% for item in items %}
  {{ import 'file.html' with { foo: item } }}
{% endfor %}

{# file.html #}
{{ index }} does not exist here, but {{ foo }} does.
```

#### Comments
```twig
{# comments can be single-line #}
```