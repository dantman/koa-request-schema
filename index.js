'use strict';

var merge = require('lodash').merge;
var assert = require('assert');

const DEFAULT_ERROR_ENVS = ['development', 'dev', 'test', 'testing'];
const INVALID_PARAMS_ERROR_MSG = 'Invalid request parameters';

var convertTo = {
  date: function(d) {
    return new Date(d);
  },
  integer: function(n) {
    return parseInt(n, 10);
  },
  number: function(n) {
    return parseFloat(n, 10);
  },
  boolean: function(b) {
    return 'true' === b;
  },
  object: function(o) {
    return JSON.parse(o);
  }
};

function convertOne(item, schema, types) {
  if (schema.type && convertTo[schema.type] && 'string' === typeof item) {
    if ('*' === types || types.indexOf(schema.type) > -1) {
      return convertTo[schema.type](item);
    }
  } else if (schema.properties) {
    for (var i in schema.properties) {
      if (item && item[i]) {
        item[i] = convertOne(item[i], schema.properties[i], types);
      }
    }
  }

  return item;
}

function convertStringToType(ctx, schema) {
  ctx.params = convertOne(ctx.params, schema.properties.params || {}, '*');
  ctx.request.body = convertOne(ctx.request.body, schema.properties.body || {}, ['date']);

  // there is a setter on ctx.query which doesnt let us directly set the query object
  let parsedQuery = convertOne(ctx.query, schema.properties.query || {}, '*');
  merge(ctx.query, parsedQuery);
}

module.exports = exports = function(schema, opt) {
  opt = merge({}, exports.defaults, { strict: true }, opt);

  var validator = opt.validator;
  if (!validator) {
    validator = new (require('jsonschema').Validator)();
    require('jsonschema-extra')(validator);
  }

  var coerceTypes = opt.coerceTypes;
  var strict = opt.strict;

  var fnSchema = ('function' === typeof schema);
  var objSchema = ('object' === typeof schema);
  var parsedSchema;

  // add base schemas used for tightening what gets through the request
  validator.addSchema({}, '@koa-framework/not-strict');
  validator.addSchema({ additionalProperties: false }, '@koa-framework/strict');

  var baseSchema = {
    type: 'object',
    required: true,
    additionalProperties: false
  };

  // apply opt.strict
  if (!strict) {
    baseSchema.additionalProperties = true;
  }

  function parseSchema(schema) {
    return {
      type: 'object',
      required: true,
      properties: {
        body: merge({}, baseSchema, schema.body),
        query: merge({}, baseSchema, schema.query),
        // is an array with object properties
        params: merge({}, baseSchema, schema.params)
      },
      additionalProperties: false
    };
  }

  assert(objSchema || fnSchema, 'Missing/invalid schema');
  if (objSchema) {
    assert(schema && (schema.body || schema.query || schema.params), 'Missing/invalid schema');
  }
  function getSchema(ctx) {
    if (objSchema) {
      parsedSchema = parsedSchema || parseSchema(schema);
      return parsedSchema;
    } else if (fnSchema) {
      return parseSchema(schema.call(ctx, ctx));
    }
  }

  return function (ctx, next) {
    try {
      var displayErrors = opt.displayErrors;
      if (displayErrors === undefined) {
        // only return data validation errors in dev environment
        displayErrors = DEFAULT_ERROR_ENVS.indexOf(ctx.app.env) > -1 ? true : false;
      }

      var requestSchema = getSchema(ctx);

      // let fnSchema optionally not return a schema so wrap in if block
      if (requestSchema) {
        if (coerceTypes) {
          convertStringToType(ctx, requestSchema);
        }

        var res = validator.validate({
          body: ctx.request.body || {},
          query: ctx.query || {},
          params: ctx.params || {}
        }, requestSchema, {
          propertyName: 'request',
          allowUnknownAttributes: !strict,
          base: strict ? '@koa-framework/strict' : '@koa-framework/not-strict'
        });

        if (!res.valid) {
          var error = new Error(INVALID_PARAMS_ERROR_MSG);
          error.status = 400;
          error.details = { validationErrors: displayErrors ? res.errors : null };
          ctx.throw(error);
        } else {
          return next();
        }
      }
    } catch (e) {
      return Promise.reject(e);
    }
  };
};

exports.create = function(globalOpt) {
  return function(schema, opt) {
    return module.exports(schema, merge(globalOpt, opt));
  };
};

exports.defaults = {
  validator: null,
  coerceTypes: true,
  warn: console.warn.bind(console)
};
