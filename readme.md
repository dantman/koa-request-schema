koa-request-schema
==================

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![David deps][david-image]][david-url]

[![node version][node-image]][node-url]

[npm-image]: https://img.shields.io/npm/v/koa-request-schema.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-request-schema
[travis-image]: https://img.shields.io/travis/dantman/koa-request-schema.svg?style=flat-square
[travis-url]: https://travis-ci.org/dantman/koa-request-schema
[david-image]: https://img.shields.io/david/dantman/koa-request-schema.svg?style=flat-square
[david-url]: https://david-dm.org/dantman/koa-request-schema
[node-image]: https://img.shields.io/badge/node.js-%3E=_0.4-green.svg?style=flat-square
[node-url]: http://nodejs.org


`koa-request-schema` implements request data validation using jsonschema. If data does not pass validation, the server returns a `400 Bad Request` error. In non production environments, the response body is populated with the validation errors.

**Notice: `koa-request-schema@2` supports `koa@2`, if you want to use this module with `koa@1`, please use `koa-request-schema@1`.**

Usage
-----

```js
const schema = require('koa-request-schema');

router.post('/secret/:object',
	schema({
		params: {
			properties: {
				object: { type: 'string', required: true }
			}
		},
		query: {
			properties: {
				something: { type: 'string', required: false } }
			}
		},
		body: {
			properties: {
				password: { type: 'string', required: true, minLength: 10 }
			}
		}
	}),
	async function (ctx) {
		let body = ctx.request.body;

		if (body.password === 'the best password ever') {
			ctx.body = 'You got it boss';
		} else {
			ctx.throw(403, 'Pffttt...');
		}
	});
```

The error includes the following properties on schema validation error. The `validationErrors` property is the `errors` property returned by `jsonschema` on validation.

```json
{
	"message": "Invalid request parameters",
	"details": {
		"validationErrors": [{
			"property": "request.body",
			"message": "Property password is required",
			"schema": { ... },
			"instance": ...
		}]
	}
}
```

Options
-------

Options may be passed as the second argument to `koa-request-schema`; additionally `require('koa-request-schema').create({ ... })` will return a function with options you pass it as defaults.

* `displayErrors` [default=`true` in non-production environments]: Include validationErrors in the error.
* `coerceTypes` [default=`true`]: Convert string values for date, integer, number, boolean, and object types to their respective type.
* `validator`: Override the jsonschema Validator instance used.
* `strict` [default=`true`]: Do not permit unknown properties in params, query, or body unless the schema defines its own `additionalProperties` value. (Default cannot be changed)

[Changelog](./history.md)
-------------------------