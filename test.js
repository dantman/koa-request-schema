/* globals describe, it */

'use strict';

//process.env.NODE_ENV = 'test';

describe('koa-request-schema', function() {
	var chai = require('chai');
	var expect = chai.expect;
	chai.use(require('chai-datetime'));

	var request = require('request');

	var koa = require('koa');
	var Router = require('koa-router');
	var bodyparser = require('koa-body-parser');
	var reqSchema = require(__dirname);

	function makeApp() {
		var app = koa();
		app.use(bodyparser());
		app.use(function *(next) {
			try {
				yield next;
			} catch (err) {
				this.status = err.status || 500;
				this.body = { error: err.message, details: err.details };
			}
		});
		app.router = new Router();
		app.use(app.router.routes());
		app.use(app.router.allowedMethods());

		return app;
	}

	// port generator
	var port = (function() {
		var _id = 3000;
		return function() {
			return ++_id;
		};
	})();

	it('should throw an error if no schema is given', function() {
		expect(function() {
			var app = makeApp();

			app.router.post('/', reqSchema(), function *() {
				this.body = this.request.body;
			}); // jshint ignore:line
		}).to.throw(/schema/i);
	});

	it('should throw an error if params do not match schema', function(done) {
		var schema = {
			params: {
				properties: {
					a: { type: 'string', required: true, enum: ['a', 'b', 'c'] }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.get('/a/:a', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '/a/d',
			json: true
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			expect(res.body.error).to.match(/invalid\srequest\sparameters/i);
			expect(res.body.details.validationErrors).to.have.length(1);
			expect(res.body.details.validationErrors[0]).to.have.property('stack', 'request.params.a is not one of enum values: a,b,c');
			done();
		});
	});

	it('should throw an error if request contains items not in schema', function(done) {
		var schema = {
			params: {
				properties: {}
			},
			query: {
				properties: {}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/a/:a', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '/a/d?a=1',
			method: 'POST',
			json: { a: 1 }
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			expect(res.body.error).to.match(/invalid\srequest\sparameters/i);
			expect(res.body.details.validationErrors).to.have.length(3);
			expect(res.body.details.validationErrors[0]).to.have.property('stack', 'request.body additionalProperty "a" exists in instance when not allowed');
			expect(res.body.details.validationErrors[1]).to.have.property('stack', 'request.query additionalProperty "a" exists in instance when not allowed');
			expect(res.body.details.validationErrors[2]).to.have.property('stack', 'request.params additionalProperty "a" exists in instance when not allowed');
			done();
		});
	});

	it('should throw an error if query does not match schema', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.get('/', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?b=123&c=456',
			json: true
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			done();
		});
	});

	it('should throw an error if json body does not match schema', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				}
			},
			body: {
				properties: {
					a: { type: 'number', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=a',
			method: 'POST',
			form: 'a=a&b=123&c=456'
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			done();
		});
	});

	it('should return the errors for a json request', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.get('/', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?b=123&c=456',
			json: true
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			expect(res.body.error).to.match(/invalid\srequest/i);
			expect(res.body.details.validationErrors).to.be.an('array');
			done();
		});
	});

	it('should return the errors for a html request', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				}
			}
		};

		process.env.NODE_ENV = 'development';

		var p = port();
		var app = makeApp();

		app.router.get('/', reqSchema(schema), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?b=123&c=456',
			headers: { Accept: 'text/html' }
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			expect(res.body).to.match(/invalid\srequest/i);
			// soft checking validation errors were passed in the html
			expect(res.body).to.match(/request\.query/i);

			process.env.NODE_ENV = 'test';
			done();
		});
	});

	it('should not return errors if displayErrors is off', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.get('/', reqSchema(schema, { displayErrors: false }), function *() {
			this.body = this.request.body;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?b=123&c=456',
			json: true
		}, function(err, res) {
			expect(res.statusCode).to.equal(400);
			expect(res.body.error).to.match(/invalid\srequest/i);
			// soft checking validation errors were passed in the html
			expect(res.body.details.validationErrors).to.equal(null);
			done();
		});
	});

	describe('.create', function() {
		it('should .create a function with an extra set of default options', function(done) {
			var schema = {
				query: {
					properties: {
						a: { type: 'string', required: true }
					}
				}
			};

			var p = port();
			var app = makeApp();
			var reqSchema2 = reqSchema.create({ displayErrors: false });

			app.router.get('/', reqSchema2(schema), function *() {
				this.body = this.request.body;
			}); // jshint ignore:line

			app.listen(p);

			request({
				url: 'http://localhost:' + p + '?b=123&c=456',
				json: true
			}, function(err, res) {
				expect(res.statusCode).to.equal(400);
				expect(res.body.error).to.match(/invalid\srequest/i);
				// soft checking validation errors were passed in the html
				expect(res.body.details.validationErrors).to.equal(null);
				done();
			});
		});
	});

	it('should override strict option if additionalProperties exists in schema', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				},
				additionalProperties: true
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=a&b=b&c=c',
			method: 'POST'
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			done();
		});
	});

	it('should work for an integer type', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'integer', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema, { coerceTypes: true }), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=123',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			expect(res.body.a).to.equal(123);
			done();
		});
	});

	it('should work for a number type', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'number', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema, { coerceTypes: true }), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=123.45',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			expect(res.body.a).to.equal(123.45);
			done();
		});
	});

	it('should work for a date type', function(done) {
		var a = new Date();
		var b = new Date();

		var schema = {
			params: {
				properties: {
					a: { type: 'date', required: true },
					b: { type: 'date', required: false },
					c: { type: 'date', required: false }
				}
			},
			body: {
				properties: {
					a: { type: 'date', required: true },
					b: { type: 'date', required: false },
					c: { type: 'date', required: false }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/a/:a/b/:b', reqSchema(schema, { coerceTypes: true }), function *() {
			function assert(item) {
				expect(item.a).to.equalDate(a);
				expect(item.b).to.equalDate(b);
				expect(item).to.not.have.property('c');
			}

			assert(this.params);
			assert(this.request.body);

			this.status = 204;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '/a/' + JSON.stringify(a).replace(/"/g, '') + '/b/' + JSON.stringify(b).replace(/"/g, ''),
			method: 'POST',
			json: { a: a, b: b }
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(204);
			done();
		});
	});

	it('should work for a boolean type', function(done) {
		var schema = {
			params: {
				properties: {
					a: { type: 'boolean', required: true },
					b: { type: 'boolean', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/a/:a/b/:b', reqSchema(schema, { coerceTypes: true }), function *() {
			this.body = this.params;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '/a/true/b/false',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			expect(res.body.a).to.equal(true);
			expect(res.body.b).to.equal(false);
			done();
		});
	});

	it('should work for an object type', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'object', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema, { coerceTypes: true }), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		var a = { b: 'c' };
		request({
			url: 'http://localhost:' + p + '?a=' + encodeURIComponent(JSON.stringify(a)),
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			expect(res.body.a).to.eql({ b: 'c' });
			done();
		});
	});

	it('should work for an integer type if enabled globally', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'integer', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema, {coerceTypes: true}), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=123',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			done();
		});
	});

	it('should not work for an integer type if not enabled', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'integer', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema, { coerceTypes: false }), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=123',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(400);
			done();
		});
	});

	it('should support multiple schema layers with coerceTypes on', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'integer', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();
		var reqSchema2 = reqSchema.create({ coerceTypes: true });

		app.router.post('/', reqSchema2(schema), reqSchema2(schema), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=1',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			done();
		});
	});

	it('should support function schema', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'integer', required: true }
				}
			},
			params: {
				properties: {
					a: { type: 'string', required: true }
				}
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/a/:a', reqSchema(function() {
			return schema;
		}, { coerceTypes: true }), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '/a/a?a=1',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should not throw validation error
			expect(res.statusCode).to.equal(200);
			done();
		});
	});

	it('should not support unknown attributes by default', function(done) {
		var schema = {
			query: {
				properties: {
					a: { type: 'string', required: true }
				},
				bla: 'bla'
			}
		};

		var p = port();
		var app = makeApp();

		app.router.post('/', reqSchema(schema), function *() {
			this.body = this.query;
		}); // jshint ignore:line

		app.listen(p);

		request({
			url: 'http://localhost:' + p + '?a=a',
			method: 'POST',
			json: true
		}, function(err, res) {
			// should throw an error
			expect(res.statusCode).to.equal(500);

			done();
		});
	});
});